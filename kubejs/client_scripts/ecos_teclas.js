// ECOS v12.2 · Tecla de los STATS: Ctrl + F (Cha, 18-nov 08:55: "Ctrl+S no: con S vas atrás y con Ctrl corres; Ctrl+F o Shift+F").
// Igual que Shift + F (Sistema): la F es «cambiar de mano», y el servidor la intercepta. Para eso necesita saber si tienes Ctrl
// apretado: este script le avisa cuando lo aprietas y cuando lo sueltas (solo en el juego, sin pantallas abiertas). El servidor
// cancela el cambio de mano y abre la ventana STATUS (startup_scripts/ecos_forge.js + server_scripts/ecos_teclas.js).
var ECT_IC = null, _ectCtrl = false;
try { ECT_IC = Java.loadClass('com.mojang.blaze3d.platform.InputConstants'); } catch (e) { console.info('[ECOS-TECLAS] sin InputConstants: ' + e); }
ClientEvents.tick(function (event) {
  if (!ECT_IC) return;
  try {
    if (!Client.player) return;
    var w = Client.getWindow().getWindow();
    var ctrl = !Client.screen && (ECT_IC.isKeyDown(w, 341) || ECT_IC.isKeyDown(w, 345));   // Ctrl izquierdo / derecho
    if (ctrl != _ectCtrl) { _ectCtrl = ctrl; Client.player.sendData('ecos_ctrl', { d: ctrl }); }
  } catch (e) {}
});
