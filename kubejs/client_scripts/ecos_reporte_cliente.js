// ECOS v12.2 · Datos del cliente para los reportes (server_scripts/ecos_reportes.js). Cuando alguien escribe «reporte ...» el
// servidor pregunta y este script le contesta con sus FPS, su distancia de render y el shader que trae activo. Solo lectura:
// no cambia nada del juego. Llega con la actualización automática (Prism).
// Al entrar, le dice al servidor qué versión del pack trae (ecos_aviso_pack.js solo avisa a quien NO la tenga)
ClientEvents.loggedIn(function (event) {
  try { Client.player.sendData('ecos_pack', { v: '12.2', prism: true }); } catch (e) { console.info('[ECOS-PACK] no pude avisar: ' + e); }
});
NetworkEvents.dataReceived('ecos_diag_pide', function (event) {
  var fps = -1, render = -1, shaders = '';
  try { fps = Number(Client.getFps()); } catch (e) {
    try { fps = Number(String(Client.fpsString).split(' ')[0]); } catch (e2) {}
  }
  try { render = Number(Client.options.renderDistance().get()); } catch (e) {}
  try { var Iris = Java.loadClass('net.irisshaders.iris.Iris'); shaders = String(Iris.getCurrentPackName()); } catch (e) {
    try { var Iris2 = Java.loadClass('net.coderbot.iris.Iris'); shaders = String(Iris2.getCurrentPackName()); } catch (e2) { shaders = '?'; }
  }
  try {
    Client.player.sendData('ecos_diag', { id: event.data.getInt('id'), fps: fps, render: render, shaders: shaders });
  } catch (e) { console.info('[ECOS-REPORTE] no pude mandar los datos: ' + e); }
});
