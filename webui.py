#!/usr/bin/env python


# Bitcoin WebUI
# Copyright (C) 2012 Michael Sparmann (TheSeven)
#
#     This program is free software; you can redistribute it and/or
#     modify it under the terms of the GNU General Public License
#     as published by the Free Software Foundation; either version 2
#     of the License, or (at your option) any later version.
#
#     This program is distributed in the hope that it will be useful,
#     but WITHOUT ANY WARRANTY; without even the implied warranty of
#     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#     GNU General Public License for more details.
#
#     You should have received a copy of the GNU General Public License
#     along with this program; if not, write to the Free Software
#     Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
#
# Please consider donating to 14HtZ9MmCginBWqdELnqAKA7vF4qbn7R9d
# if you want to support further development of Bitcoin WebUI.



import sys
import os
import time
import signal
import shutil
import socket
import ssl
import base64
from threading import Thread
from api import handlermap
try: import urllib.parse as urllib
except: import urllib
try: from socketserver import ThreadingTCPServer
except: from SocketServer import ThreadingTCPServer
try: from http.server import BaseHTTPRequestHandler
except: from BaseHTTPServer import BaseHTTPRequestHandler



class WebUI(object):

  version = "Bitcoin WebUI v0.0.1"


  def __init__(self, config):
    self.config = config
    credentials = config.rpcusername + ":" + config.rpcpassword
    self.rpcauth = "Basic " + base64.b64encode(credentials.encode("utf_8")).decode("ascii")
    self.httpd = None


  def start(self):
    self.httpd = ThreadingTCPServer((self.config.bindip, self.config.bindport), RequestHandler, False)
    self.httpd.webui = self
    self.httpd.allow_reuse_address = True
    self.httpd.daemon_threads = True
    tcp_socket = socket.socket(self.httpd.address_family, self.httpd.socket_type)
    self.httpd.socket = ssl.wrap_socket(tcp_socket, self.config.privkeyfile, self.config.pubkeyfile, True)
    self.httpd.server_bind()
    self.httpd.server_activate()
    self.serverthread = Thread(None, self.httpd.serve_forever, "httpd")
    self.serverthread.start()


  def stop(self):
    self.httpd.shutdown()
    self.serverthread.join(5)
    self.httpd.server_close()



class RequestHandler(BaseHTTPRequestHandler):

  server_version = WebUI.version
  rootfile = "/index.htm"
  mimetypes = {
    '': 'application/octet-stream',  # Default
    '.htm': 'text/html; charset=UTF-8',
    '.html': 'text/html; charset=UTF-8',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.js': 'text/javascript; charset=UTF-8',
    '.css': 'text/css; charset=UTF-8',
    }


  def log_request(self, code = "-", size = "-"):
    if code == 200:
      if size != "-": self.log_message("HTTP request: %s \"%s\" %s %s", self.address_string(), self.requestline, str(code), str(size))
    else: self.log_error("Request failed: %s \"%s\" %s %s", self.address_string(), self.requestline, str(code), str(size))


  def log_error(self, format, *args):
    print(format % args)


  def log_message(self, format, *args):
    print(format % args)


  def do_HEAD(self):
    # Essentially the same as GET, just without a body
    self.do_GET(False)


  def do_GET(self, send_body = True):
    # Figure out the base path that will be prepended to the requested path
    basepath = os.path.realpath(os.path.join(os.path.dirname(__file__), "wwwroot"))
    # Remove query strings and anchors, and unescape the path
    path = urllib.unquote(self.path.split('?',1)[0].split('#',1)[0])
    # Rewrite requests to "/" to the specified root file
    if path == "/": path = self.__class__.rootfile
    # Paths that don't start with a slash are invalid => 400 Bad Request
    if path[0] != "/": return self.fail(400)
    # Check authentication and figure out privilege level
    privileges = self.check_auth()
    if not privileges:
      # Invalid credentials => 401 Authorization Required
      self.fail(401, [("WWW-Authenticate", "Basic realm=\"Bitcoin WebUI\"")])
      return None
    # Figure out the actual filesystem path to the requested file
    path = os.path.realpath(os.path.join(basepath, path[1:]))
    # If it tries to escape from the wwwroot directory => 403 Forbidden
    if path[:len(basepath)] != basepath: return self.fail(403)
    # If it simply isn't there => 404 Not Found
    if not os.path.exists(path): return self.fail(404)
    # If it isn't a regular file (but e.g. a directory) => 403 Forbidden
    if not os.path.isfile(path): return self.fail(403)
    # Try to figure out the mime type based on the file name extension
    ext = os.path.splitext(path)[1]
    mimetypes = self.__class__.mimetypes
    if ext in mimetypes: mimetype = mimetypes[ext]
    elif ext.lower() in mimetypes: mimetype = mimetypes[ext.lower()]
    else: mimetype = mimetypes['']
    try:
      f = open(path, "rb")
      # Figure out file size using seek/tell
      f.seek(0, os.SEEK_END)
      length = f.tell()
      f.seek(0, os.SEEK_SET)
      # Send response headers
      self.log_request(200, length)
      self.send_response(200)
      self.send_header("Content-Type", mimetype)
      self.send_header("Content-Length", length)
      self.end_headers()
      # Send file data to the client, if this isn't a HEAD request
      if send_body: shutil.copyfileobj(f, self.wfile, length)
    # Something went wrong, no matter what => 500 Internal Server Error
    except: self.fail(500)
    finally:
      try: f.close()
      except: pass


  def do_POST(self):
    # Remove query strings and anchors, and unescape the path
    path = urllib.unquote(self.path.split('?',1)[0].split('#',1)[0])
    # Paths that don't start with a slash are invalid => 400 Bad Request
    if path[0] != "/": return self.fail(400)
    # Check authentication and figure out privilege level
    privileges = self.check_auth()
    if not privileges:
      # Invalid credentials => 401 Authorization Required
      self.fail(401, [("WWW-Authenticate", "Basic realm=\"Bitcoin WebUI\"")])
      return None
    # Look for a handler for that path and execute it if present
    if path in handlermap:
      handlermap[path](self.server.webui, self, path, privileges)
    # No handler for that path found => 404 Not Found
    else: self.fail(404)


  def check_auth(self):
    # Check authentication and figure out privilege level
    authdata = self.headers.get("authorization", None)
    credentials = ""
    if authdata != None:
      authdata = authdata.split(" ", 1)
      if authdata[0].lower() == "basic":
        try: credentials = base64.b64decode(authdata[1].encode("ascii")).decode("utf_8")
        except: pass
    privileges = None
    if credentials in self.server.webui.config.users:
      privileges = self.server.webui.config.users[credentials]
    return privileges


  def fail(self, status, headers = []):
    self.send_response(status)
    for header in headers:
      self.send_header(*header)
      self.send_header("Content-Length", 0)
      self.end_headers()



class Bunch(dict):


  def __init__(self, **kw):
    dict.__init__(self, kw)
    self.__dict__ = self


  def __getstate__(self):
    return self


  def __setstate__(self, state):
    self.update(state)
    self.__dict__ = self



if __name__ == "__main__":

  from config import config
  webui = WebUI(Bunch(**config))

  def stop(signum, frame):
    webui.stop()
    sys.exit(0)

  signal.signal(signal.SIGINT, stop)
  signal.signal(signal.SIGTERM, stop)

  webui.start()

  while True: time.sleep(100)
