// ECOS v12.1 · Este cliente trae el arte del HUD del Sistema (kubejs/assets/ecos/textures/gui/sistema/).
// Le avisa al servidor (canal ecos_ui) para que dibuje los marcos con textura; sin este aviso el servidor
// usa la versión de colores, que funciona en cualquier cliente. Va SOLO en el zip v12.1.
ClientEvents.loggedIn(function (event) {
  try {
    Client.player.sendData('ecos_ui', { v: 121 });
  } catch (e) {
    console.info('[ECOS-UI] no pude avisar al servidor: ' + e);
  }
});
