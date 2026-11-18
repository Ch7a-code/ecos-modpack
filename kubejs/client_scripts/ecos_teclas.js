// ECOS v12.2 · Tecla propia para los STATS: Ctrl + S (pedido Z1 de Cha, 18-nov). Todas las letras solas ya están ocupadas y Alt es
// «rodar» (Combat Roll), así que va con Ctrl. Solo cuenta en el juego (sin ninguna pantalla abierta) y una vez por pulsación.
// Le avisa al servidor (canal ecos_tecla) y él abre la ventana STATUS (server_scripts/ecos_teclas.js). Llega con Prism.
var ECT_IC = null, _ectAntes = false;
try { ECT_IC = Java.loadClass('com.mojang.blaze3d.platform.InputConstants'); } catch (e) { console.info('[ECOS-TECLAS] sin InputConstants: ' + e); }
ClientEvents.tick(function (event) {
  if (!ECT_IC) return;
  try {
    if (!Client.player || Client.screen) { _ectAntes = false; return; }
    var w = Client.getWindow().getWindow();
    var ctrl = ECT_IC.isKeyDown(w, 341) || ECT_IC.isKeyDown(w, 345);   // Ctrl izquierdo / derecho
    var ahora = ctrl && ECT_IC.isKeyDown(w, 83);                        // S
    if (ahora && !_ectAntes) Client.player.sendData('ecos_tecla', { k: 'stats' });
    _ectAntes = ahora;
  } catch (e) {}
});
