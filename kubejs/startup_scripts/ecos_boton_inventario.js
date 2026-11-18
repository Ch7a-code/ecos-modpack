// ECOS v12.2 · Botón ◈ en el inventario (E) que abre tu ventana STATUS (pedido Z1 de Cha, 18-nov). Solo en el cliente: en el servidor
// dedicado no existen las pantallas, por eso se registra únicamente si Platform dice que es cliente. Si algo falla, no hay botón
// (nunca rompe el inventario). Al pulsarlo avisa al servidor por el canal ecos_tecla (server_scripts/ecos_teclas.js).
if (Platform.isClientEnvironment()) {
  try {
    var EBI_Inv = Java.loadClass('net.minecraft.client.gui.screens.inventory.InventoryScreen');
    var EBI_Btn = Java.loadClass('net.minecraft.client.gui.components.Button');
    var EBI_Tip = Java.loadClass('net.minecraft.client.gui.components.Tooltip');
    var EBI_Txt = Java.loadClass('net.minecraft.network.chat.Component');
    var EBI_Mc = Java.loadClass('net.minecraft.client.Minecraft');
    ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Init$Post', function (event) {
      try {
        var s = event.getScreen();
        if (!(s instanceof EBI_Inv)) return;
        var x = s.getGuiLeft() + 176 - 22, y = s.getGuiTop() - 22;
        var b = EBI_Btn.builder(EBI_Txt.literal('◈'), function (boton) {
          try { EBI_Mc.getInstance().player.sendData('ecos_tecla', { k: 'stats' }); } catch (e) { console.info('[ECOS-TECLAS] botón: ' + e); }
        }).bounds(x, y, 20, 20).tooltip(EBI_Tip.create(EBI_Txt.literal('Mi Eco · stats (Ctrl + F)'))).build();
        event.addListener(b);
      } catch (e) { console.info('[ECOS-TECLAS] inventario: ' + e); }
    });
  } catch (e) { console.info('[ECOS-TECLAS] no se pudo poner el botón del inventario: ' + e); }
}
