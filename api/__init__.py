from . import bcrpc

handlermap = {
  "/bcrpc": bcrpc.passthrough,
}
