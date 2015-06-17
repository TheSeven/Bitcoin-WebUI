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



import traceback
try: import http.client as http_client
except ImportError: import httplib as http_client



def passthrough(webui, httprequest, path, privileges):
  if privileges != "fullaccess": return httprequest.send_response(403)
  try:
    contenttype = httprequest.headers.get("content-type")
    length = int(httprequest.headers.get("content-length"))
    data = b""
    while len(data) < length: data += httprequest.rfile.read(length - len(data))
  except:
    httprequest.send_response(400)
    raise
  headers = {
    "Connection": "Keep-Alive",
    "User-Agent": webui.version,
    "Authorization": webui.rpcauth,
    "Content-Type": contenttype,
    "Content-Length": length,
  }
  try:
    conn = http_client.HTTPConnection(webui.config.rpchost, webui.config.rpcport, timeout=10)
    conn.request("POST", webui.config.rpcpath, data, headers)
    response = conn.getresponse()
    contenttype = response.getheader("content-type")
    data = response.read()
    httprequest.log_request(200, len(data))
    httprequest.send_response(200)
    httprequest.send_header("Content-Type", contenttype)
    httprequest.send_header("Content-Length", len(data))
    httprequest.end_headers()
    httprequest.wfile.write(data)
  except Exception as e:
    httprequest.send_response(500)
    raise
