Bitcoin WebUI
Copyright (C) 2012 Michael Sparmann (TheSeven)

    This program is free software; you can redistribute it and/or
    modify it under the terms of the GNU General Public License
    as published by the Free Software Foundation; either version 2
    of the License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.

Please consider donating to 14HtZ9MmCginBWqdELnqAKA7vF4qbn7R9d
if you want to support further development of Bitcoin WebUI.


Overview
========

Bitcoin WebUI is a JavaScript web interface for bitcoind, allowing to access
most of bitcoind's RPC functions through an easy to use web interface if you
don't want to run bitcoin-qt locally or just prefer a web interface.


System Requirements
===================

Bitcoin WebUI requires Python >= 2.6, most testing is done with Python 3.2.
The required Python modules should usually be installed by default.
Bitcoin WebUI uses bitcoind as a backend via its RPC interface.


Getting started
===============

1. Copy config.py.example to config.py
2. Adjust configuration settings as neccessary
3. Generate SSL certificate for the web server:
   openssl req -new -newkey rsa:1024 -days 365 -nodes -x509 -keyout server.pem -out server.cert
4. Run python webui.py
5. Connect to https://localhost:8338 with your favorite web browser
