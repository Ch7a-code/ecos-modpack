// ECOS · Mapa único de teclas con Alt — Anexo 8 (Ars Nouveau, YA PROBADO en producción) + F6 extensión (20-nov,
// Saint Seiya New Generation 3.1.9 + Book of Dragons 1.4.2). Un solo script, UNA vez por cliente, mismo patrón:
// options.txt del pack solo aplica a instalaciones NUEVAS (publicar_pack.py lo preserva); a quien ya juega se le
// mueven las teclas la primera vez que entra tras la actualización. Si el jugador ya cambió una tecla a mano, se
// respeta (no se toca si ya no está en su valor de fábrica).
//
// Colisiones verificadas en el options.txt real de la prueba de hoy (cliente-prueba-mods, ground-truth, no
// adivinado) + javap de cada jar (ModKeyMappings / KeyBindings, todas KeyMapping normales, ninguna lee GLFW en
// bruto):
//   Ars Nouveau (5): C libro · V rueda de hechizos · X siguiente slot · Z slot anterior · G curio de cabeza.
//     Choca con: C = Alex's Caves special_ability · V = Iron's spellbook_cast · X = quiver de Supplementaries ·
//     Z = voicespells (Incantation) toggle_listening · G = rueda de Iron's. YA RESUELTO (script original, intacto).
//   Saint Seiya NG (11, javap SaintSeiyaNouvelleGenerationModKeyMappings, GLFW bipush verificado):
//     R(82) armure_desequiper · P(80) mission · Y(89) dimensions("Secret Armor Ability") · K(75) boost_power ·
//     Z(90) skillone · X(88) skilltwo · C(67) blocking · V(86) six_senth · B(66) septsenth · M(77) skillthreeshow
//     ("Player menu") · O(79) cosmossense. Las 11 chocan con algo del pack hoy: R con JEI showRecipe + TaCZ
//     reload · P con Apotheosis world_tiers_arent_real · Y con Cataclysm chestplate_ability · K con Ad Astra
//     toggle_suit_flight · Z con voicespells · X con Supplementaries quiver · C con Alex's Caves + ya es Alt+C de
//     Ars · V con Iron's spellbook_cast + ya es Alt+V de Ars · B con "eop" battlemode · M con Xaero map +
//     Structurize mirror · O con TaCZ interact. Por eso las 11 se mueven a Alt (Cha, Anexo 11: "¿cómo podríamos
//     asignarle sus propias teclas o combinación?"). C y V no pueden quedar en Alt+C/Alt+V (ya son de Ars) y se
//     mueven a Alt+F (bloqueo) y Alt+S (sexto Sentido) en su lugar.
//   Book of Dragons (javap KeyBindings, montado): G(71) open_inventory · C(67) secondary_ability · R(82) dismount ·
//     X(88) grab · Z(90) target_lock — mismas colisiones de arriba (G con Iron's, C con Alex's Caves, R con
//     JEI+TaCZ, X con Supplementaries, Z con voicespells). debug_toggle(F4) y roost_lines(F6) chocan con
//     voicechat (pruebas 20-nov) y son solo de depuración: se dejan SIN TECLA, igual que el resto de slots de Ars
//     sin reemplazo. dragon_sprint(Ctrl) y primary_ability/free_camera (clic izq/der) no chocan: sin tocar.
// Verificado: Alt+letra está 100% libre hoy en options.txt (solo JEI usa Alt, con clic de mouse y flechas, nunca
// con una letra) → ningún Alt+letra de abajo se repite entre Ars/Seiya/BoD (18 letras usadas, 8 libres).
// Marca por bloque en kubejs/config/: no se repite si ya corrió. Rhino: solo var.
var EAR = { hecho: false, t: 0 };
var EAR_FABRICA = { 'key.ars_nouveau.open_book': 'key.keyboard.c', 'key.ars_nouveau.selection_hud': 'key.keyboard.v',
  'key.ars_nouveau.next_slot': 'key.keyboard.x', 'key.ars_nouveau.previous_slot': 'key.keyboard.z', 'key.ars_nouveau.head_curio_hotkey': 'key.keyboard.g' };
var EAR_NUEVA = { 'key.ars_nouveau.open_book': ['key.keyboard.c', 'ALT'], 'key.ars_nouveau.selection_hud': ['key.keyboard.v', 'ALT'] };

// F6 (20-nov): Saint Seiya New Generation — 11 teclas, todas a Alt+<letra> (letra propia salvo C/V, ya de Ars).
var EST = { hecho: false, t: 0 };
var EST_FABRICA = {
  'key.saint_seiya_nouvelle_generation.armure_desequiper': 'key.keyboard.r',
  'key.saint_seiya_nouvelle_generation.mission': 'key.keyboard.p',
  'key.saint_seiya_nouvelle_generation.dimensions': 'key.keyboard.y',
  'key.saint_seiya_nouvelle_generation.boost_power': 'key.keyboard.k',
  'key.saint_seiya_nouvelle_generation.skillone': 'key.keyboard.z',
  'key.saint_seiya_nouvelle_generation.skilltwo': 'key.keyboard.x',
  'key.saint_seiya_nouvelle_generation.blocking': 'key.keyboard.c',
  'key.saint_seiya_nouvelle_generation.six_senth': 'key.keyboard.v',
  'key.saint_seiya_nouvelle_generation.septsenth': 'key.keyboard.b',
  'key.saint_seiya_nouvelle_generation.skillthreeshow': 'key.keyboard.m',
  'key.saint_seiya_nouvelle_generation.cosmossense': 'key.keyboard.o'
};
var EST_NUEVA = {
  'key.saint_seiya_nouvelle_generation.armure_desequiper': ['key.keyboard.r', 'ALT'],
  'key.saint_seiya_nouvelle_generation.mission': ['key.keyboard.p', 'ALT'],
  'key.saint_seiya_nouvelle_generation.dimensions': ['key.keyboard.y', 'ALT'],
  'key.saint_seiya_nouvelle_generation.boost_power': ['key.keyboard.k', 'ALT'],
  'key.saint_seiya_nouvelle_generation.skillone': ['key.keyboard.z', 'ALT'],
  'key.saint_seiya_nouvelle_generation.skilltwo': ['key.keyboard.x', 'ALT'],
  'key.saint_seiya_nouvelle_generation.blocking': ['key.keyboard.f', 'ALT'],
  'key.saint_seiya_nouvelle_generation.six_senth': ['key.keyboard.s', 'ALT'],
  'key.saint_seiya_nouvelle_generation.septsenth': ['key.keyboard.b', 'ALT'],
  'key.saint_seiya_nouvelle_generation.skillthreeshow': ['key.keyboard.m', 'ALT'],
  'key.saint_seiya_nouvelle_generation.cosmossense': ['key.keyboard.o', 'ALT']
};

// F6 (20-nov): Book of Dragons — 5 teclas a Alt+<letra nueva>; debug_toggle/roost_lines sin tecla (depuración).
var EBD = { hecho: false, t: 0 };
var EBD_FABRICA = {
  'key.bookofdragons.open_inventory': 'key.keyboard.g',
  'key.bookofdragons.secondary_ability': 'key.keyboard.c',
  'key.bookofdragons.dismount': 'key.keyboard.r',
  'key.bookofdragons.grab': 'key.keyboard.x',
  'key.bookofdragons.target_lock': 'key.keyboard.z',
  'key.bookofdragons.debug_toggle': 'key.keyboard.f4',
  'key.bookofdragons.roost_lines': 'key.keyboard.f6'
};
var EBD_NUEVA = {
  'key.bookofdragons.open_inventory': ['key.keyboard.g', 'ALT'],
  'key.bookofdragons.secondary_ability': ['key.keyboard.n', 'ALT'],
  'key.bookofdragons.dismount': ['key.keyboard.d', 'ALT'],
  'key.bookofdragons.grab': ['key.keyboard.h', 'ALT'],
  'key.bookofdragons.target_lock': ['key.keyboard.t', 'ALT']
  // debug_toggle y roost_lines: sin entrada = se quitan (KMod.NONE + UNKNOWN), igual que los 3 slots de Ars sin reemplazo.
};

function _earMoverUno(IC, KMod, marcaArchivo, estado, fabrica, nueva, etiqueta) {
  if (estado.hecho) return;
  var marca = null;
  try { marca = JsonIO.read(marcaArchivo); } catch (e0) { marca = null; }
  if (marca && marca.hecho) { estado.hecho = true; return; }
  if (!Client.options) return;
  var lista = Client.options.keyMappings, movidas = 0, hayMod = false;
  for (var i = 0; i < lista.length; i++) {
    var k = lista[i], nom = String(k.getName());
    if (!fabrica[nom]) continue;
    hayMod = true;
    if (String(k.getKey().getName()) != fabrica[nom] || String(k.getKeyModifier()) != 'NONE') continue;   // el jugador ya la cambió
    var n = nueva[nom];
    if (n) k.setKeyModifierAndCode(KMod.valueOf(n[1]), IC.getKey(n[0]));
    else k.setKeyModifierAndCode(KMod.NONE, IC.UNKNOWN);
    movidas++;
  }
  estado.hecho = true;
  if (!hayMod) return;   // ese mod no está instalado: nada que hacer
  JsonIO.write(marcaArchivo, { hecho: true, movidas: movidas });
  console.info('[ECOS-TECLAS] ' + etiqueta + ': ' + movidas + ' movidas');
}

ClientEvents.tick(function () {
  if (EAR.hecho && EST.hecho && EBD.hecho) return;
  if (++EAR.t % 20) return;                 // una vez por segundo hasta lograr las 3
  if (EAR.t > 20 * 600) { EAR.hecho = true; EST.hecho = true; EBD.hecho = true; return; }   // 10 min sin lograrlo: se rinde sin llenar el log
  try {
    if (!Client.options) return;
    var IC = Java.loadClass('com.mojang.blaze3d.platform.InputConstants');
    var KMod = Java.loadClass('net.minecraftforge.client.settings.KeyModifier');
    var KM = Java.loadClass('net.minecraft.client.KeyMapping');
    var antes = EAR.hecho && EST.hecho && EBD.hecho;
    _earMoverUno(IC, KMod, 'kubejs/config/ecos_teclas_ars.json', EAR, EAR_FABRICA, EAR_NUEVA, 'Ars (libro Alt+C, menu radial Alt+V)');
    _earMoverUno(IC, KMod, 'kubejs/config/ecos_teclas_seiya.json', EST, EST_FABRICA, EST_NUEVA, 'Saint Seiya (11 a Alt)');
    _earMoverUno(IC, KMod, 'kubejs/config/ecos_teclas_bod.json', EBD, EBD_FABRICA, EBD_NUEVA, 'Book of Dragons (5 a Alt, 2 sin tecla)');
    if (!antes && EAR.hecho && EST.hecho && EBD.hecho) { KM.resetMapping(); Client.options.save(); }
  } catch (e) {
    if (EAR.t % 600 == 0) console.info('[ECOS-TECLAS] ' + e);
  }
});
