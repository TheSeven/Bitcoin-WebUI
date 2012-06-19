// Bitcoin WebUI
// Copyright (C) 2012 Michael Sparmann (TheSeven)
//
//     This program is free software; you can redistribute it and/or
//     modify it under the terms of the GNU General Public License
//     as published by the Free Software Foundation; either version 2
//     of the License, or (at your option) any later version.
//
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.
//
//     You should have received a copy of the GNU General Public License
//     along with this program; if not, write to the Free Software
//     Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
//
// Please consider donating to 14HtZ9MmCginBWqdELnqAKA7vF4qbn7R9d
// if you want to support further development of Bitcoin WebUI.


globalDeps = [
  "dojo/dom",
  "dojo/ready",
  "dojo/parser",
  "dojo/data/ItemFileWriteStore",
  "dojo/store/Memory",
  "dojo/date/locale",
  "dojox/layout/TableContainer",
  "dijit/Menu",
  "dijit/MenuItem",
  "dijit/MenuBar",
  "dijit/MenuBarItem",
  "dijit/Dialog",
  "dijit/TitlePane",
  "dijit/Tree",
  "dijit/tree/ForestStoreModel",
  "dijit/tree/dndSource",
  "dijit/form/Form",
  "dijit/form/TextBox",
  "dijit/form/ValidationTextBox",
  "dijit/form/NumberTextBox",
  "dijit/form/Textarea",
  "dijit/form/Button",
  "dijit/form/FilteringSelect",
  "dijit/form/CurrencyTextBox",
  "dijit/layout/ContentPane",
  "dijit/layout/TabContainer",
  "dijit/layout/BorderContainer",
];


var currency = "BTC";
var txnsPerRequest = 200;
var txnFetchThreshold = 1000;
var info = {};
var accounts = [];
var accountContextMenuTarget = null;
var addressToAccount = {};
var currentTxnSource = "root";
var currentTxnCount = 0;
var fetchingTxns = false;
var gotAllTxns = false;
var txnEpoch = 0;
var walletIsEncrypted = false;
var walletIsLocked = false;
var donationAddress = "16MN18YuXFDyYFja2jHSeBUTgCpUByf5kv";


require(globalDeps, function()
{
  dojo.ready(function()
  {
    refreshAccountList(function()
    {
      setInterval(refreshGlobalInfo, 10000);
      var loadingNode = document.getElementById("loadingPlaceholder");
      loadingNode.parentNode.removeChild(loadingNode);
    });
  });
});


function handleError(context, message, callback)
{
  console.error(String(message));
  dojo.byId("errorMessage").innerText = String(message);
  var dialog = dijit.byId("errorDialog");
  dialog.context = context;
  dialog.callback = callback;
  dialog.show();
  dijit.byId("refreshButton").set("disabled", false);
}


function refreshGlobalInfo(callback)
{
  BCRPC.call("getinfo", [], 0, null, function(context, id, result)
  {
    info = result;
    walletIsEncrypted = result.hasOwnProperty("unlocked_until");
    walletIsLocked = walletIsEncrypted && !result.unlocked_until;
    donationAddress = info.testnet ? "mhFwRrjRNt8hYeWtm9LwqCpCgXjF38RJqn" : "16MN18YuXFDyYFja2jHSeBUTgCpUByf5kv";
    updateGlobalInfo();
    if (callback) callback();
  }, handleError);
}


function refreshAccountList(callback)
{
  dijit.byId("refreshButton").set("disabled", true);
  BCRPC.call("listaccounts", [0], 0, null, function(context, id, result)
  {
    BCRPC.call("listreceivedbyaddress", [0, true], 0, null, function(context, id, received)
    {
      refreshGlobalInfo(function()
      {
        accounts = {}
        for (var i in result)
          if (result.hasOwnProperty(i))
            accounts[i] = {balance: result[i], addresses: {}};
        for (var i in received)
          if (received.hasOwnProperty(i) && accounts[received[i].account])
          {
            accounts[received[i].account].addresses[received[i].address] = received[i].amount;
            addressToAccount[received[i].address] = received[i].account;
          }
        updateAccountList();
        refreshTransactionList(function()
        {
          dijit.byId("refreshButton").set("disabled", false);
          if (callback) callback();
        });
      });
    }, handleError);
  }, handleError);
}


function refreshTransactionList(callback)
{
  txnEpoch++;
  fetchingTxns = false;
  gotAllTxns = false;
  currentTxnCount = 0;
  var container = dojo.byId("transactionContainer");
  while (container.firstChild) container.removeChild(container.firstChild);
  getMoreTransactions(callback);
}


function updateGlobalInfo()
{
  dojo.byId("currentWalletBalance").innerText = info.balance + " " + currency;
  dojo.byId("currentKeypoolSize").innerText = info.keypoolsize;
  dojo.byId("currentDifficulty").innerText = info.difficulty;
  dojo.byId("currentBlocks").innerText = info.blocks;
  dojo.byId("currentConnections").innerText = info.connections;
  dijit.byId("lockWalletButton").set("disabled", !walletIsEncrypted || walletIsLocked);
}


function updateAccountList()
{
  var accountNameEntrys = accountNameStore.data.slice();
  for (var i = 0; i < accountNameEntrys.length; i++) accountNameStore.remove(accountNameEntrys[i].id);
  removeRecursively(accountStore, "children", accountStore._arrayOfTopLevelItems);
  accountStore.revert();
  accountStore._arrayOfAllItems = [];
  var accountRootItem = accountStore.newItem({id: "root", label: "All accounts", balance: info.balance, children: []});
  for (var i in accounts)
    if (accounts.hasOwnProperty(i))
    {
      accountNameStore.add({id: i, "name": i ? i : "<default>"});
      var addrs = accounts[i].addresses;
      var sum = 0;
      for (var j in addrs)
        if (addrs.hasOwnProperty(j))
          sum += addrs[j];
      var accData = {id: "acc_" + i, label: i ? i : "<default>", balance: accounts[i].balance, children: []};
      var accItem = accountStore.newItem(accData, {parent: accountRootItem, attribute: "children"});
      var spentData = {id: "spent_" + i, label: "Spent / Generated", balance: accounts[i].balance - sum};
      accountStore.newItem(spentData, {parent: accItem, attribute: "children"});
      for (var j in addrs)
        if (addrs.hasOwnProperty(j))
        {
          var addrData = {id: "addr_" + j, label: j, balance: addrs[j]};
          accountStore.newItem(addrData, {parent: accItem, attribute: "children"});
        }
    }
}


function makeTransactionField(parent, float, minWidth, bold, value)
{
  var div = document.createElement("div");
  if (float) div.style.float = float;
  if (bold) div.style.fontWeight = "bold";
  if (minWidth) div.style.minWidth = minWidth;
  div.style.padding = "1px 0.5ex";
  div.appendChild(document.createTextNode(value ? value : "-"));
  parent.appendChild(div);
  return div;
}


function getMoreTransactions(callback)
{
  var myEpoch = txnEpoch;
  fetchingTxns = true;
  var source = "*";
  var filter = null;
  var sourceParts = currentTxnSource.split("_", 2);
  if (sourceParts[0] == "acc") source = sourceParts[1];
  else if (sourceParts[0] == "spent")
  {
    source = sourceParts[1];
    filter = function(txn)
    {
      return txn.category != "receive";
    };
  }
  else if (sourceParts[0] == "addr")
  {
    source = addressToAccount[sourceParts[1]];
    filter = function(txn)
    {
      return txn.address == sourceParts[1];
    };
  }
  BCRPC.call("listtransactions", [source, txnsPerRequest, currentTxnCount], 0, null, function(context, id, result)
  {
    if (myEpoch != txnEpoch)
    {
      if (callback) callback();
      return;
    }
    if (result.length < txnsPerRequest) gotAllTxns = true;
    var container = dojo.byId("transactionContainer");
    for (var i = result.length - 1; i >= 0; i--)
      if (!filter || filter(result[i]))
      {
        var formattedFee = result[i].fee ? result[i].fee + " " + currency : null;
        var txnRow = document.createElement("div");
        txnRow.className = "dijitMenuBar";
        txnRow.style.marginBottom = "-1px";
        var row1 = document.createElement("div");
        row1.style.clear = "both";
        var timeString = dojo.date.locale.format(new Date(result[i].time * 1000));
        var timeField = makeTransactionField(row1, "left", "15ex", false, timeString);
        var amountField = makeTransactionField(row1, "right", "12ex", true, result[i].amount + " " + currency);
        var commentField = makeTransactionField(row1, null, null, true, result[i].comment);
        txnRow.appendChild(row1);
        var row2 = document.createElement("div");
        row2.style.clear = "both";
        var confirmationsField = makeTransactionField(row2, "left", "5ex", false, result[i].confirmations);
        var typeField = makeTransactionField(row2, "left", "9ex", false, result[i].category);
        var feeField = makeTransactionField(row2, "right", "12ex", false, formattedFee);
        var addressField = makeTransactionField(row2, "right", "40ex", false, result[i].address);
        if (!result[i].to) result[i].to = addressToAccount[result[i].address];
        var toField = makeTransactionField(row2, null, null, true, result[i].to);
        txnRow.appendChild(row2);
        container.appendChild(txnRow);
      }
    currentTxnCount += result.length;
    fetchingTxns = false;
    setTimeout(transactionListScrollHandler, 0);
    if (callback) callback();
  }, handleError);
}


function createAccountTreeNode(args)
{
  var treeNode = new dijit._TreeNode(args);
  var balanceNode = document.createElement("div");
  balanceNode.style.cssFloat = "right";
  balanceNode.appendChild(document.createTextNode(args.item.balance + " " + currency));
  treeNode.labelNode.appendChild(balanceNode);
  if (args.item.children) treeNode.labelNode.style.fontWeight = "bold";
  return treeNode;
}


function removeRecursively(store, childattr, children)
{
  if (!children) return;
  children = children.slice();
  for (var i = 0; i < children.length; i++)
  {
    removeRecursively(store, childattr, children[i][childattr]);
    store.deleteItem(children[i]);
  }
}


function copyText(text)
{
  var box = dojo.byId("copyTextDialogValueBox")
  box.value = text;
  dijit.byId("copyTextDialog").show();
  box.select();
}


function accountTreeClickHandler(item)
{
  currentTxnSource = accountStore.getValue(item, "id");
  refreshTransactionList();
}


function accountTreeDNDGovernor(target, source, position)
{
  var targetParts = accountStore.getValue(dijit.getEnclosingWidget(target).item, "id").split("_", 2);
  if (targetParts[0] != "acc" || position != "over") return false;
  var accept = true;
  var sourceCount = 0;
  var sourceType = null;
  source.forInSelectedItems(function (item)
  {
    var sourceParts = accountStore.getValue(item.data.item, "id").split("_", 2);
    if (sourceParts[0] != "addr") accept = false;
    sourceCount++;
    sourceType = sourceParts[0];
  });
  if (sourceType == "acc" && sourceCount == 1) return true;
  return accept;
}


function accountTreeDNDHandler(source, nodes, copy, target)
{
  var dstParts = accountStore.getValue(target.targetAnchor.item, "id").split("_", 2);
  this.inherited("onDndDrop", arguments);
  if (dstParts[0] != "acc") return refreshAccountList();
  var scheduled = [];
  for (var i = 0; i < nodes.length; i++)
  {
    var srcParts = accountStore.getValue(dijit.getEnclosingWidget(nodes[i]).item, "id").split("_", 2);
    if (nodes.length == 1 && srcParts[0] == "acc")
    {
      showMoveFundsDialog(srcParts[1], dstParts[1]);
      return refreshAccountList();
    }
    if (srcParts[0] != "addr") continue;
    scheduled.push(srcParts[1]);
  }
  var left = scheduled.length;
  if (!left) return refreshAccountList();
  for (var i = 0; i < scheduled.length; i++)
    highlevelRPC("setaccount", [scheduled[i], dstParts[1]], 0, null, function(context, id, result)
    {
      if (!--left) refreshAccountList();
    }, function(context, error)
    {
      handleError(context, error);
      refreshAccountList();
    });
}


function acceptEverythingValidator(isFocused)
{
  return true;
}


function transactionListScrollHandler()
{
  if (fetchingTxns || gotAllTxns) return;
  var container = dojo.byId("transactionContainer");
  if (container.scrollHeight - container.offsetHeight - container.scrollTop < txnFetchThreshold) getMoreTransactions();
}


function accountContextMenuInitializer(args)
{
  var item = dijit.getEnclosingWidget(args.target).item;
  var target = item ? accountStore.getValue(item, "id").split("_", 2) : null;
  accountContextMenuTarget = target;
  dijit.byId("accountContextMenuSendBitcoins").set("disabled", !target || target[0] == "addr");
  dijit.byId("accountContextMenuMoveFunds").set("disabled", !target || target[0] == "addr");
  dijit.byId("accountContextMenuCreateNewAddress").set("disabled", !target || target[0] == "addr");
  dojo.byId("accountContextMenuCreateNewAccountBasedOnAddress").style.display = target[0] == "addr" ? "inline" : "none";
  dijit.byId("accountContextMenuSignMessage").set("disabled", !target || target[0] != "addr");
  dijit.byId("accountContextMenuExportKey").set("disabled", !target || target[0] != "addr");
}


function showSendBitcoinsDialog(account, address)
{
  dijit.byId("sendBitcoinsForm").setValues({
    sourceAccount: account ? account : "",
    destinationAddress: address ? address : "",
    destinationComment: "",
    amount: 0,
    transactionComment: "",
  });
  dijit.byId("sendBitcoinsDialog").show();
}


function sendBitcoinsFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    form.submitting = true;
    dijit.byId("sendBitcoinsButton").set("disabled", true);
    highlevelRPC("sendfrom", [
      values.sourceAccount,
      values.destinationAddress,
      values.amount,
      0,
      values.transactionComment,
      values.destinationComment,
    ], 0, null, function(context, id, result)
    {
      form.submitting = false;
      dijit.byId("sendBitcoinsButton").set("disabled", false);
      dojo.byId("transactionIdDialogIdField").innerText = result;
      dijit.byId("transactionIdDialog").show();
      refreshAccountList();
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("sendBitcoinsButton").set("disabled", false);
      handleError(context, error);
      refreshAccountList();
    });
  }
}


function showDonateDialog()
{
  showSendBitcoinsDialog("", donationAddress);
}


function showMoveFundsDialog(fromaccount, toaccount)
{
  dijit.byId("moveFundsForm").setValues({
    sourceAccount: fromaccount ? fromaccount : "",
    destinationAccount: toaccount ? toaccount : "",
    amount: 0,
    comment: "",
  });
  dijit.byId("moveFundsDialog").show();
}


function moveFundsFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    form.submitting = true;
    dijit.byId("moveFundsButton").set("disabled", true);
    var rpcArguments = [values.sourceAccount, values.destinationAccount, values.amount, 0, values.comment];
    highlevelRPC("move", rpcArguments, 0, null, function(context, id, result)
    {
      form.submitting = false;
      dijit.byId("moveFundsButton").set("disabled", false);
      dijit.byId("moveFundsDialog").hide();
      refreshAccountList();
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("moveFundsButton").set("disabled", false);
      handleError(context, error);
      refreshAccountList();
    });
  }
}


function showSignMessageDialog(address)
{
  dijit.byId("signMessageForm").address = address;
  dojo.byId("signMessageDialogAddressField").innerText = address;
  dijit.byId("signMessageDialog").show();
}


function signMessageFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    form.submitting = true;
    dijit.byId("signMessageButton").set("disabled", true);
    dojo.byId("signMessageSignatureArea").style.display = "none";
    highlevelRPC("signmessage", [form.address, values.message], 0, null, function(context, id, result)
    {
      dojo.byId("signMessageSignatureDataField").innerText = result;
      dojo.byId("signMessageSignatureArea").style.display = "block";
      form.submitting = false;
      dijit.byId("signMessageButton").set("disabled", false);
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("signMessageButton").set("disabled", false);
      handleError(context, error);
    });
  }
}


function verifySignatureFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    form.submitting = true;
    dijit.byId("verifySignatureButton").set("disabled", true);
    dojo.byId("verifySignatureResultArea").style.display = "none";
    highlevelRPC("verifymessage", [values.address, values.signature, values.message], 0, null,
                 function(context, id, result)
    {
      dojo.byId("verifySignatureValidityField").innerText = result ? "Signature is valid" : "Signature is invalid!";
      dojo.byId("verifySignatureResultArea").style.display = "block";
      form.submitting = false;
      dijit.byId("verifySignatureButton").set("disabled", false);
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("verifySignatureButton").set("disabled", false);
      handleError(context, error);
    });
  }
}


function showEncryptionDialog()
{
  if (walletIsEncrypted) dijit.byId("changePassphraseDialog").show();
  else dijit.byId("encryptWalletDialog").show();
}


function encryptWalletFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    if (values.password1 != values.password2)
    {
      handleError(null, "Passwords do not match!");
      return;
    }
    form.submitting = true;
    dijit.byId("encryptWalletButton").set("disabled", true);
    form.setValues({password1: "", password2: ""});
    BCRPC.call("encryptwallet", [values.password1], 0, null, function(context, id, result)
    {
      form.submitting = false;
      dijit.byId("encryptWalletButton").set("disabled", false);
      dijit.byId("encryptWalletDialog").hide();
      handleError(null, "Wallet has been encrypted and bitcoind has shut down.");
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("encryptWalletButton").set("disabled", false);
      handleError(context, error);
    });
  }
}


function changePassphraseFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    var values = form.getValues();
    if (values.password1 != values.password2)
    {
      handleError(null, "Passwords do not match!");
      return;
    }
    form.submitting = true;
    dijit.byId("changePassphraseButton").set("disabled", true);
    form.setValues({oldpassword: "", password1: "", password2: ""});
    BCRPC.call("walletpassphrasechange", [values.oldpassword, values.password1], 0, null, function(context, id, result)
    {
      form.submitting = false;
      dijit.byId("changePassphraseButton").set("disabled", false);
      dijit.byId("changePassphraseDialog").hide();
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("changePassphraseButton").set("disabled", false);
      handleError(context, error);
    });
  }
}


function showExportKeyDialog(address)
{
  highlevelRPC("dumpprivkey", [address], 0, null, function(context, id, result)
  {
    dojo.byId("exportKeyDialogAddressField").innerText = address;
    dojo.byId("exportKeyDialogPrivateKeyField").innerText = result;
    dijit.byId("exportKeyDialog").show();
  },handleError);
}


function importKeysFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    form.submitting = true;
    dijit.byId("importKeysButton").set("disabled", truie);
    var values = form.getValues();
    var split = values.keys.replace(/\r|\n/g, " ").split(" ");
    var keys = [];
    for (var i = 0; i < split.length; i++)
      if (split[i])
        keys.push(split[i]);
    (function handleKeys()
    {
      if (keys.length)
      {
        var key = keys.shift();
        highlevelRPC("importprivkey", [key], 0, null, function(context, id, result)
        {
          values.keys = values.keys.replace(key, "");
          handleKeys();
        }, function(context, error)
        {
          handleError(context, "Error importing private key " + key + ":\n" + error, function(context)
          {
            handleKeys();
          });
        });
      }
      else
      {
        form.setValues(values);
        form.submitting = false;
        dijit.byId("importKeysButton").set("disabled", false);
        refreshAccountList();
      }
    })();
  }
}


function showCreateNewAccountDialog(address)
{
  dijit.byId("createNewAccountForm").setValues({account: "", address: address ? address : ""});
  dijit.byId("createNewAccountDialog").show();
}


function createNewAccountFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    form.submitting = true;
    dijit.byId("createNewAccountButton").set("disabled", true);
    var values = form.getValues();
    generateAddressIfNotSet(values.address, null, function(address)
    {
      highlevelRPC("setaccount", [address, values.account], 0, null, function(context, id, result)
      {
        form.submitting = false;
        dijit.byId("createNewAccountButton").set("disabled", false);
        dijit.byId("createNewAccountDialog").hide();
        refreshAccountList();
      }, function(context, error)
      {
        handleError(context, error);
        form.submitting = false;
        dijit.byId("createNewAccountButton").set("disabled", false);
        refreshAccountList();
      });
    }, function(context, error)
    {
      handleError(context, error);
      form.submitting = false;
      dijit.byId("createNewAccountButton").set("disabled", false);
      refreshAccountList();
    });
  }
}


function generateAddressIfNotSet(address, context, callback, errorcallback)
{
  if (address)
  {
    if (callback) callback(address);
    return;
  }
  highlevelRPC("getnewaddress", [], 0, null, function(context, id, result)
  {
    if (callback) callback(result);
  }, function(context, error)
  {
    if (errorcallback) errorcallback(context, error);
    else refreshAccountList();
  });
}


function createNewAddressForAccount(account)
{
  highlevelRPC("getnewaddress", [account], 0, null, function(context, id, result)
  {
    dojo.byId("newAddressCreatedDialogAccountField").innerText = account ? account : "<default>";
    dojo.byId("newAddressCreatedDialogAddressField").innerText = result;
    dijit.byId("newAddressCreatedDialog").show();
    refreshAccountList();
  }, function(context, error)
  {
    handleError(context, error);
    refreshAccountList();
  });
}


function lockWallet()
{
  BCRPC.call("walletlock", [], 0, null, function(context, id, result)
  {
    refreshGlobalInfo();
  }, handleError);
}


function refillKeyPool()
{
  highlevelRPC("keypoolrefill", [], 0, null, function(context, id, result)
  {
    refreshGlobalInfo();
  }, handleError);
}


function highlevelRPC(method, params, id, context, callback, errorcallback)
{
  if (!context) context = {};
  context.lastRPCError = null;
  BCRPC.call(method, params, id, context, callback, function(context, error)
  {
    if (context.lastRPCError && context.lastRPCError.code == -13)
    {
      showUnlockWalletDialog(context, error, function(context)
      {
        highlevelRPC(method, params, id, context, callback, errorcallback);
      }, errorcallback);
    }
    else if (errorcallback) errorcallback(context, error);
  });
}


function showUnlockWalletDialog(context, error, callback, errorcallback)
{
  var dialog = dijit.byId("unlockWalletDialog");
  dialog.context = context;
  dialog.error = error;
  dialog.callback = callback;
  dialog.errorcallback = errorcallback;
  dialog.show();
}

function unlockWalletFormSubmitHandler(form)
{
  if (form.submitting) return;
  if (form.validate())
  {
    form.submitting = true;
    dijit.byId("unlockWalletButton").set("disabled", true);
    var values = form.getValues();
    form.setValues({password: ""});
    var dialog = dijit.byId("unlockWalletDialog");
    BCRPC.call("walletpassphrase", [values.password, values.timeout], 0, dialog.context, function(context, id, result)
    {
      form.submitting = false;
      dijit.byId("unlockWalletButton").set("disabled", false);
      dialog.errorcallback = null;
      dialog.hide();
      if (dialog.callback) dialog.callback(context);
    }, function(context, error)
    {
      form.submitting = false;
      dijit.byId("unlockWalletButton").set("disabled", false);
      handleError(context, error);
    });
  }
}

/*
 { "sendmany",               &sendmany,               false },

 { "settxfee",               &settxfee,               false },
 { "backupwallet",           &backupwallet,           true },

 { "addmultisigaddress",     &addmultisigaddress,     false },
 { "sendrawtx",              &sendrawtx,              false },
 { "getaccountaddress",      &getaccountaddress,      true },
 */
