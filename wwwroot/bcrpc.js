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


window.BCRPC = new (function()
{
  this.call = function(method, params, id, context, callback, errorcallback)
  {
    try
    {
      var data = JSON.stringify({method: method, params: params, id: id});
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function()
      {
        try
        {
          if (xhr.readyState == 4)
          {
            if (xhr.status == 200)
            {
              var type = xhr.getResponseHeader("Content-Type");
              if (type.split(";", 1)[0] != "application/json") throw "RPC bad content type: " + type;
              var data = JSON.parse(xhr.responseText);
              if (data.error)
              {
                if (context) context.lastRPCError = data.error;
                throw "RPC error " + data.error.code + ": " + data.error.message;
              }
              else if (callback) callback(context, data.id, data.result);
            }
            else if (xhr.status == 0 || xhr.status > 999) throw "RPC connection failed: " + xhr.status;
            else throw "RPC HTTP error " + xhr.status;
          }
        }
        catch (error)
        {
          if (errorcallback) errorcallback(context, error);
          else throw error;
        }
      };
      xhr.open("POST", "/bcrpc", true);
      xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");
      xhr.send(data);
    }
    catch (error)
    {
      if (errorcallback) errorcallback(context, error);
      else throw error;
    }
  };
})();
