// ECOS · Anexo 8 (Ars Nouveau): sus 5 teclas de fábrica chocan con el pack (javap de ModKeyBindings, 20-nov):
//   C = habilidad especial de Echoes · V = lanzar hechizo de Iron's · X = carcaj de Supplementaries · Z = escuchar voz · G = rueda de hechizos.
// options.txt del pack solo aplica a instalaciones NUEVAS (publicar_pack.py lo preserva), así que a quien ya juega se las mueve este
// script UNA vez: libro de Ars = Alt+C · menú radial = Alt+V · siguiente/anterior/curio de cabeza = sin tecla.
// Solo si siguen en su tecla de fábrica: si el jugador ya las cambió, se respeta. Marca: kubejs/config/ecos_teclas_ars.json.
var EAR = { hecho: false, t: 0 };
var EAR_FABRICA = { 'key.ars_nouveau.open_book': 'key.keyboard.c', 'key.ars_nouveau.selection_hud': 'key.keyboard.v',
  'key.ars_nouveau.next_slot': 'key.keyboard.x', 'key.ars_nouveau.previous_slot': 'key.keyboard.z', 'key.ars_nouveau.head_curio_hotkey': 'key.keyboard.g' };
var EAR_NUEVA = { 'key.ars_nouveau.open_book': ['key.keyboard.c', 'ALT'], 'key.ars_nouveau.selection_hud': ['key.keyboard.v', 'ALT'] };
ClientEvents.tick(function () {
  if (EAR.hecho) return;
  if (++EAR.t % 20) return;                 // una vez por segundo hasta lograrlo
  if (EAR.t > 20 * 600) { EAR.hecho = true; return; }   // 10 min sin lograrlo: se rinde sin llenar el log
  try {
    var marca = null;
    try { marca = JsonIO.read('kubejs/config/ecos_teclas_ars.json'); } catch (e0) { marca = null; }
    if (marca && marca.hecho) { EAR.hecho = true; return; }
    if (!Client.options) return;
    var IC = Java.loadClass('com.mojang.blaze3d.platform.InputConstants');
    var KMod = Java.loadClass('net.minecraftforge.client.settings.KeyModifier');
    var KM = Java.loadClass('net.minecraft.client.KeyMapping');
    var lista = Client.options.keyMappings, movidas = 0, hayArs = false;
    for (var i = 0; i < lista.length; i++) {
      var k = lista[i], nom = String(k.getName());
      if (!EAR_FABRICA[nom]) continue;
      hayArs = true;
      if (String(k.getKey().getName()) != EAR_FABRICA[nom] || String(k.getKeyModifier()) != 'NONE') continue;   // el jugador ya la cambió
      var n = EAR_NUEVA[nom];
      if (n) k.setKeyModifierAndCode(KMod.valueOf(n[1]), IC.getKey(n[0]));
      else k.setKeyModifierAndCode(KMod.NONE, IC.UNKNOWN);
      movidas++;
    }
    EAR.hecho = true;
    if (!hayArs) return;                    // sin Ars Nouveau instalado: nada que hacer
    KM.resetMapping();
    Client.options.save();
    JsonIO.write('kubejs/config/ecos_teclas_ars.json', { hecho: true, movidas: movidas });
    console.info('[ECOS-TECLAS-ARS] teclas de Ars movidas: ' + movidas + ' (libro Alt+C, menú radial Alt+V)');
  } catch (e) {
    if (EAR.t % 600 == 0) console.info('[ECOS-TECLAS-ARS] ' + e);
  }
});
