// ECOS · ARCHIVO VIVO (cliente). Recibe del servidor los datos de cada pestaña (server_scripts/ecos_archivo.js), los pone en
// variables de FancyMenu (av_<nombre>) y abre la pantalla propia archivo_<pestaña>. Si no trae "abrir", solo refresca:
// la pantalla sigue abierta y los textos cambian al instante (FancyMenu relee las variables cada cuadro).
// API de FancyMenu 3.9.0 verificada con javap (19-nov): VariableHandler.setVariable(String, String) y
// CustomGuiHandler.constructInstance(String id, Screen padre, Screen alCerrar).
var AV_VH = null, AV_CG = null;
try {
  AV_VH = Java.loadClass('de.keksuccino.fancymenu.customization.variables.VariableHandler');
  AV_CG = Java.loadClass('de.keksuccino.fancymenu.customization.customgui.CustomGuiHandler');
} catch (e) { console.info('[ECOS-AV] sin FancyMenu: ' + e); }

NetworkEvents.dataReceived('ecos_av', function (event) {
  if (!AV_VH) return;
  try {
    var d = event.data, it = d.getAllKeys().iterator(), abrir = '';
    while (it.hasNext()) {
      var k = String(it.next());
      if (k == 'abrir') { abrir = String(d.getString(k)); continue; }
      var v = String(d.getString(k));
      AV_VH.setVariable('av_' + k, v === '' ? '§r' : v);   // vacío: el marcador getvariable de FancyMenu pinta "0"; §r no pinta nada
    }
    if (abrir == '__inventario') {   // botón Árbol: el árbol de habilidades está en Inventario → Poderes
      var INV = Java.loadClass('net.minecraft.client.gui.screens.inventory.InventoryScreen');
      Client.setScreen(new INV(Client.player));
    } else if (abrir && AV_CG) {
      var s = AV_CG.constructInstance('archivo_' + abrir, null, null);
      if (s) Client.setScreen(s);
    }
  } catch (e) { console.info('[ECOS-AV] ' + e); }
});
