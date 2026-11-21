// ECOS v12.1 · ARRANQUE (startup): cambiar este archivo pide REINICIAR el juego; /reload no lo vuelve a leer.
// ForgeEvents solo existe aquí. Mecanismo probado en P-FORGE (15-nov): LivingHurtEvent#setAmount, SpellPreCastEvent#setCanceled.
//
// 1) Tope de daño por golpe y por segundo para los jefes llave y de Maestro que NO traen tope propio
//    (los de Cataclysm ya lo traen: cap por golpe y cubeta de 20 ticks en cataclysm-common.toml).
//    Diseño §3.14 + R9: una SPAS-12 (48 por disparo) mataba al Wroughtnaut (40) de un tiro.
//    Meta: ninguno cae en menos de ~30 s con el grupo. La vida extra está en server_scripts/ecos_jefes.js.
// 2) Iron's Spellbooks: hechizos que se bloquean AL LANZAR según la Era del jugador (sirve para libro, vara, pergamino
//    y arma): Teleport/Recall/Portal y la escuela Holy = Era II · épicos = Era III · legendarios = Era IV.
//    La Era del jugador es la etiqueta ecos_eraN que pone ecos_misiones.js (la Era del mundo, para todos).

// Anexo 16 §2 (camino B, aprobado por Cha 20-nov 14:37): modelo nuevo de topes, UN jefe primero (Hydra) para medir antes de
// tocar los otros 12. id -> T_objetivo en segundos (Era I 60 · Maestro 75 · II 90 · III 120 · IV 150 · Final 180). El jefe que
// está aquí deja de usar su fila de ECOS_TOPE: tope por golpe = 10 % de su vida vigente (duro) y tope por segundo blando.
var ECOS_TOPE_V2 = { 'twilightforest:hydra': 90 };
var ECOS_TOPE_GOLPE_FR = 0.10, ECOS_TOPE_F1 = 0.50, ECOS_TOPE_K2 = 2.0, ECOS_TOPE_F2 = 0.05;
// [daño máximo por golpe, daño máximo por segundo]
var ECOS_TOPE = {
  'mowziesmobs:ferrous_wroughtnaut': [12, 8],
  'twilightforest:naga': [12, 8],
  'twilightforest:lich': [12, 8],
  'twilightforest:hydra': [15, 12],
  'minecraft:ender_dragon': [15, 12],
  'mowziesmobs:frostmaw': [15, 10],
  'mowziesmobs:sculptor': [15, 10],
  'twilightforest:snow_queen': [15, 10],
  // S4 (Estudio, aprobado por Cha 20-nov: «que el tope de daño crezca con el número de jugadores»): los 5 de Cataclysm traían un tope
  // NATIVO fijo (cataclysm-common.toml) mientras su vida sí crece con la escuadra -> ir en grupo alargaba la pelea ~75 %. Ahora el
  // tope nativo va en 999999 en el servidor y el de ECOS (mismos valores que el nativo) se multiplica por 'ecos_esc_tope'.
  'cataclysm:netherite_monstrosity': [25, 20],
  'cataclysm:ignis': [20, 14],
  'cataclysm:the_harbinger': [22, 14],
  'cataclysm:the_leviathan': [20, 15],
  'cataclysm:maledictus': [20, 13]
};
// jefe (la entidad misma, llave débil: se libera al morir) -> [segundo real, daño acumulado en ese segundo]
// (16-nov, cliente-prueba: ent.getUUID() NO existe para Rhino en este contexto; por eso no se usa UUID)
var _ecosVentana = new (Java.loadClass('java.util.WeakHashMap'))();

function ecosIdEntidad(ent) {
  try { var s = ent.getEncodeId(); if (s) return String(s); } catch (e) {}
  try { return String(ent.type); } catch (e2) {}
  return '';
}

// Laboratorio: las criaturas escapadas (etiqueta ecos_lab) pegan máximo 3 por golpe (First Aid: la cabeza tiene 4).
var ECOS_LAB_TOPE = 3;

// --- v12.2 (Cha, 18-nov 05:01-05:15): escalado, poder con stats y estamina relativa. Todo del lado del servidor. ---
// a) Monstruos escalados (server_scripts/ecos_escalado.js): su daño a jugadores x persistentData 'ecos_esc_dano'; el tope de
//    daño de los jefes de ECOS_TOPE x 'ecos_esc_tope' (si no, subir Fuerza no serviría contra ellos).
// b) Poder con stats (server_scripts/ecos_stats.js): el daño de los poderes de Echoes of Power y Palladium (tipo de daño eop:* o
//    palladium:*) x persistentData 'ecos_st_mpoder' del lanzador (Fuerza o Inteligencia según la familia del don).
// c) Estamina relativa (Stamina for Tweakers, interfaz Exhaustible.depleteStamina, javap 18-nov): golpe que conecta = 15 % del
//    daño (+0.5 por cada enemigo extra del mismo golpe, máx. +2; blandir ya cuesta 1 en su config) · que te peguen = 25 % del
//    daño · bloquear con escudo = 30 % de lo bloqueado · cada flecha del arco = 2.
var ECOS_EOP_DANO = {};
['acidic_poison', 'basic', 'basic_projectile', 'blood', 'boil', 'brain_hurt', 'collapse', 'cursed_finger', 'decay', 'erasure', 'fuga',
  'ice', 'implode', 'info_overwhelm', 'magala_corrupt_damage', 'marine_rain', 'mimic_beam', 'mirror', 'pain', 'purple', 'radiation', 'red',
  'sandstorm', 'scream', 'shock', 'slash', 'slash_strong', 'slime', 'smith_crush', 'spirit_damage', 'spores', 'suffocation', 'supernova',
  'tremor', 'true_basic', 'warped_water', 'world_slash', 'world_slash_strong'].forEach(function (k) { ECOS_EOP_DANO[k] = true; });   // data/eop/damage_type del jar
var ECOS_EST = { golpe: 0.15, extra: 0.5, extraMax: 2, recibir: 0.25, escudo: 0.30, flecha: 2 };
var _ecosGolpes = new (Java.loadClass('java.util.WeakHashMap'))();   // jugador -> [tick, enemigos extra cobrados]
function ecosTipoDano(src) {
  try { return String(src.typeHolder().unwrapKey().get().location()); } catch (e) {}
  try { var m = String(src.getMsgId()); return ECOS_EOP_DANO[m] ? 'eop:' + m : m; } catch (e2) {}
  return '';
}
function ecosEsJugador(x) { try { return !!x && x.isPlayer(); } catch (e) { return false; } }
// e) Nivel recomendado por jefe: [Conciencia recomendada, nombre]. Fuente única: lo lee también server_scripts/ecos_jefes_preparacion.js
//    (aviso de Zykna) y la ventana de misiones, vía global.ecosRec. Valores de arranque 19-nov; se afinan con ESC_PELEAS del log.
var ECOS_REC = {
  dadoPorNivel: 0.08, pisoDado: 0.15, recibidoPorNivel: 0.12, topeRecibido: 3.0,
  jefes: {
    // Era I
    'mowziesmobs:ferrous_wroughtnaut': [25, 'Wroughtnaut'], 'twilightforest:naga': [25, 'Naga'], 'twilightforest:lich': [25, 'Lich'],
    // Era II
    'twilightforest:hydra': [40, 'Hidra'], 'cataclysm:netherite_monstrosity': [40, 'Monstruosidad de Netherita'],
    // Era III
    'cataclysm:ignis': [55, 'Ignis'], 'minecraft:ender_dragon': [55, 'Dragón del End'],
    // Era IV y final (19-nov: 70/85 -> 65/75 con el ritmo MEDIDO en el host, ~200 XP/h conectado + bonos de jefe: así cada Era cae
    // en su hora del diseño —I ~6 h, II ~18 h, III ~35 h, IV ~55 h, final ~75 h—; con 85 nadie llegaba en 80 h)
    'cataclysm:the_harbinger': [65, 'El Heraldo'], 'cataclysm:the_leviathan': [65, 'El Leviatán'], 'cataclysm:maledictus': [75, 'Maledictus'],
    // jefes de Maestro (paso 5)
    'mowziesmobs:frostmaw': [30, 'Frostmaw'], 'twilightforest:snow_queen': [30, 'Reina de las Nieves'], 'cataclysm:aptrgangr': [30, 'Aptrgangr'],
    'cataclysm:ender_golem': [30, 'Gólem del End'], 'mowziesmobs:sculptor': [30, 'El Escultor'], 'cataclysm:wadjet': [30, 'Wadjet'],
    'cataclysm:the_prowler': [30, 'El Merodeador'],
    // guardianes de Maestro (paso 1)
    'aether:valkyrie_queen': [15, 'Reina Valquiria'], 'blue_skies:arachnarch': [15, 'Arachnarch'], 'blue_skies:summoner': [15, 'El Invocador'],
    'twilightforest:armored_giant': [15, 'Gigante Acorazado'], 'born_in_chaos_v1:skeleton_thrasher_not_despawn': [15, 'Esqueleto Triturador'],
    'deeperdarker:stalker': [15, 'El Acechador'], 'alexscaves:tremorsaurus': [15, 'Tremorsaurio'],
    // Anexo 16 §1 (aprobado por Cha 20-nov 14:37): jefes con tag oficial que no estaban registrados y morían de un tiro a la
    // cabeza (no estaban en ECOS_TOPE ni en PD_JEFES y su vida es < 100 o la libraba por poco). Vida base VERIFICADA en vivo
    // (server/v12, atributo generic.max_health) o en el jar con javap: Guardián Anciano 80 · Slider 400 · Espíritu del Sol 500 ·
    // Caballero Fantasma 35 · Ur-Ghast 250 · Yeti Alfa 200 · Minoseta 120 · Alquimista 500 · Triturador Estelar 500 ·
    // Luxtructosaurio 600 · Guardián del End 333 · Remanente Antiguo 450 · Escila 390. SIN tope de daño en este lote (§1.1 paso 3).
    // twilightforest:plateau_boss queda fuera: es un marcador del mod, no se deja invocar ni trae vida.
    'minecraft:elder_guardian': [15, 'Guardián Anciano'], 'aether:slider': [15, 'El Deslizador'], 'blue_skies:alchemist': [15, 'El Alquimista'],
    'twilightforest:knight_phantom': [25, 'Caballero Fantasma'], 'twilightforest:alpha_yeti': [25, 'Yeti Alfa'], 'twilightforest:minoshroom': [25, 'Minoseta'],
    'blue_skies:starlit_crusher': [25, 'Triturador Estelar'],
    'aether:sun_spirit': [30, 'Espíritu del Sol'], 'twilightforest:ur_ghast': [30, 'Ur-Ghast'], 'alexscaves:luxtructosaurus': [30, 'Luxtructosaurio'],
    'cataclysm:ender_guardian': [30, 'Guardián del End'], 'cataclysm:ancient_remnant': [30, 'Remanente Antiguo'], 'cataclysm:scylla': [30, 'Escila']
  }
};
try { global.ecosRec = ECOS_REC; } catch (eRec) {}
function ecosConciencia(p) { try { return Number(p.persistentData.getInt('ecos_nc')) || 0; } catch (e) { return 0; } }
// "Es jefe" para los puntos débiles = tiene tope de daño O nivel recomendado (revisión 19-nov: 3 guardianes de Maestro sin
// tope ni lista de zonas caían en la rama de criatura normal y morían de un tiro a la cabeza).
function ecosEsJefeId(id) { return !!ECOS_TOPE[id] || !!ECOS_REC.jefes[id]; }
function ecosNum(pd, k) { try { var v = Number(pd.getDouble(k)); return v > 0 ? v : 0; } catch (e) { return 0; } }
function ecosCansar(p, x) {
  if (!(x > 0)) return;
  try { if (p.level.isClientSide()) return; p.depleteStamina(x); } catch (e) {}
}

// S10 + S10b (Estudio 20-nov): PASIVAS de los 10 únicos de jefe. Todo por evento (cero tick). Los números viven en
// server_scripts/ecos_botin_estilo.js (global.ecosUnicos.num): se afinan con /kubejs reload; si faltan, ninguna pasiva actúa.
// El objeto se lee en mano principal y secundaria: los 3 propios por ID, los 7 retag por NBT 'ecos_unico_jefe'.
var ECOS_UJ_PROPIOS = { 'ecos:filo_primer_centinela': 'filo', 'ecos:puno_que_no_se_enfria': 'puno', 'ecos:garra_marea_honda': 'garra' };
var _ecosWHM = Java.loadClass('java.util.WeakHashMap');
var _ecosFilo = new _ecosWHM(), _ecosPuno = new _ecosWHM(), _ecosOjo = new _ecosWHM(), _ecosColmillo = new _ecosWHM(), _ecosCetro = new _ecosWHM();
function ecosUnicoDe(st) {
  try {
    if (!st || st.isEmpty()) return '';
    var id = String(st.id);
    if (ECOS_UJ_PROPIOS[id]) return ECOS_UJ_PROPIOS[id];
    var n = st.nbt;
    return n ? String(n.getString('ecos_unico_jefe') || '') : '';
  } catch (e) { return ''; }
}
function ecosUnicosEnMano(p) {
  var r = {};
  try { var a = ecosUnicoDe(p.mainHandItem), b = ecosUnicoDe(p.offHandItem); if (a) r[a] = true; if (b) r[b] = true; } catch (e) {}
  return r;
}
function ecosUN() { try { return global.ecosUnicos && global.ecosUnicos.num ? global.ecosUnicos.num : null; } catch (e) { return null; } }
// entidad directa del daño (la flecha/bala, no quien disparó): mismo orden de respaldos que ecos_puntos_debiles.js (KubeJS getImmediate)
function ecosDirecta(s) {
  if (!s) return null;
  try { var d = s.getImmediate(); if (d) return d; } catch (e1) {}
  try { var d2 = s.immediate; if (d2) return d2; } catch (e2) {}
  return null;
}

ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', function (e) {
  var ent = e.getEntity(), src = null, atq = null;
  try { src = e.getSource(); atq = src ? src.getEntity() : null; } catch (e0) {}
  try {
    if (atq && atq.getTags().contains('ecos_lab') && e.getAmount() > ECOS_LAB_TOPE) e.setAmount(ECOS_LAB_TOPE);
  } catch (errLab) {}
  var tipo = src ? ecosTipoDano(src) : '';
  // a) monstruo escalado pega más
  try {
    if (atq && !ecosEsJugador(atq) && ecosEsJugador(ent)) {
      var md = ecosNum(atq.persistentData, 'ecos_esc_dano');
      if (md > 1) e.setAmount(e.getAmount() * md);
    }
  } catch (errA) {}
  // b) tu poder sube con tu stat
  try {
    if (ecosEsJugador(atq) && (tipo.indexOf('eop:') == 0 || tipo.indexOf('palladium:') == 0)) {
      var mp = ecosNum(atq.persistentData, 'ecos_st_mpoder');
      if (mp > 1) e.setAmount(e.getAmount() * mp);
    }
  } catch (errB) {}
  // b2) Puntería: armas de fuego de TaCZ (tipo tacz:*) x 'ecos_st_mbala' del tirador
  try {
    if (ecosEsJugador(atq) && tipo.indexOf('tacz:') == 0) {
      var mb = ecosNum(atq.persistentData, 'ecos_st_mbala');
      if (mb > 1) e.setAmount(e.getAmount() * mb);
    }
  } catch (errB2) {}
  // d) puntos débiles (startup_scripts/ecos_puntos_debiles.js, Cha 18-nov 21:38): criatura normal en la cabeza = muerte (con casco
  //    x2); jefe en su punto débil = x su multiplicador, y su tope de daño sube en la misma proporción.
  var pdM = 1, pdBase = null;
  try {
    if (global.ecosPD && atq && ecosEsJugador(atq) && !ecosEsJugador(ent)) {
      var pr = global.ecosPD.evaluar(ent, src, atq, tipo, e.getAmount(), ecosEsJefeId(ecosIdEntidad(ent)));
      if (pr && pr.letal > 0) { pdBase = e.getAmount(); e.setAmount(pr.letal); }
      else if (pr && pr.mult > 1) { pdM = pr.mult; e.setAmount(e.getAmount() * pdM); }
    } else if (global.ecosPD && global.ecosPD.prueba && !ecosEsJugador(atq) && !ecosEsJugador(ent)) {   // prueba: flecha sin dueño (su atacante es ella misma)
      var pp = global.ecosPD.evaluar(ent, src, null, tipo, e.getAmount(), ecosEsJefeId(ecosIdEntidad(ent)));
      if (pp && pp.letal > 0) e.setAmount(pp.letal); else if (pp && pp.mult > 1) { pdM = pp.mult; e.setAmount(e.getAmount() * pdM); }
    }
  } catch (errD) { console.info('[ECOS-FORGE] puntos débiles: ' + errD); }
  // e) nivel recomendado (Cha 19-nov 22:0x: «el jefe debería ser difícil para que no lo pueda matar y tiene que ir preparado»).
  //    Patrón WoW (brecha de nivel) + Scadutree de Elden Ring (número visible). Si tu Conciencia está debajo de la del jefe:
  //    haces -8 % de daño por nivel que te falte (piso 15 %) y recibes +12 % por nivel (tope x3). Arriba o igual: nada cambia.
  try {
    var rj = null, rp = null;
    if (ecosEsJugador(atq) && !ecosEsJugador(ent)) { rj = ECOS_REC.jefes[ecosIdEntidad(ent)]; rp = atq; }
    else if (ecosEsJugador(ent) && atq && !ecosEsJugador(atq)) { rj = ECOS_REC.jefes[ecosIdEntidad(atq)]; rp = ent; }
    if (rj && rp) {
      var gap = rj[0] - ecosConciencia(rp);
      if (gap > 0) {
        if (rp === atq) e.setAmount(e.getAmount() * Math.max(ECOS_REC.pisoDado, 1 - ECOS_REC.dadoPorNivel * gap));
        else e.setAmount(e.getAmount() * Math.min(ECOS_REC.topeRecibido, 1 + ECOS_REC.recibidoPorNivel * gap));
      }
    }
  } catch (errE) { console.info('[ECOS-FORGE] nivel recomendado: ' + errE); }
  // f) únicos de jefe (S10b §2): después de todos los multiplicadores y ANTES del tope -> ningún único puede romper el techo
  try {
    var UN = ecosUN();
    if (UN && ecosEsJugador(atq) && atq !== ent) {
      var U = ecosUnicosEnMano(atq), mu = 1, ahoraU = Date.now(), melee = tipo.split(':').pop() == 'player';
      var directo = ecosDirecta(src);
      if (U.filo && melee) {
        var pos = _ecosFilo.get(atq), dq = 1e9, aliado = false;
        if (pos) { var fx = atq.x - pos[0], fy = atq.y - pos[1], fz = atq.z - pos[2]; dq = fx * fx + fy * fy + fz * fz; }
        _ecosFilo.put(atq, [atq.x, atq.y, atq.z]);
        try {
          atq.server.players.forEach(function (q) {
            if (aliado || q === atq || String(q.level.dimension) != String(atq.level.dimension)) return;
            var ax = q.x - atq.x, ay = q.y - atq.y, az = q.z - atq.z;
            if (ax * ax + ay * ay + az * az <= UN.filoAliado * UN.filoAliado) aliado = true;
          });
        } catch (eA) {}
        if ((pos && dq <= UN.filoQuieto * UN.filoQuieto) || aliado) mu *= UN.filoMult;
      }
      if (U.puno && melee) {
        var ch = _ecosPuno.get(atq), cargas = (ch && ahoraU - ch[0] <= UN.punoVentanaMs) ? Math.min(UN.punoMax, ch[1] + 1) : 0;
        _ecosPuno.put(atq, [ahoraU, cargas]);
        mu *= 1 + UN.punoPorGolpe * cargas;
      }
      if (U.garra && melee) { try { if (atq.isInWater() || ent.isInWater()) mu *= UN.garraMult; } catch (eW) {} }
      if (U.aliento && tipo.indexOf('tacz:') == 0) { try { ent.setSecondsOnFire(UN.alientoSeg); } catch (eF) {} }
      var poderU = tipo.indexOf('eop:') == 0 || tipo.indexOf('palladium:') == 0;
      if (poderU && U.nucleo) { try { if (global.ecosUnicos.familias(atq.server, atq).indexOf('elementales') >= 0) mu *= UN.nucleoMult; } catch (eN) {} }
      if (poderU && U.pensar) mu *= UN.pensarMult;
      if (U.ojo && tipo.indexOf('irons_spellbooks:') == 0) {
        var mapa = _ecosOjo.get(ent);
        if (!mapa) { mapa = {}; _ecosOjo.put(ent, mapa); }
        var kj = String(atq.username), mk = mapa[kj] || 0;
        mu *= 1 + UN.ojoPorMarca * mk;
        mapa[kj] = Math.min(UN.ojoMax, mk + 1);
      }
      if (U.flecha && directo && directo !== atq) { try { ent.setAbsorptionAmount(0); } catch (eAb) {} }
      if (mu > 1) e.setAmount(e.getAmount() * mu);
    }
  } catch (errF) { console.info('[ECOS-FORGE] únicos: ' + errF); }
  // tope de jefes (x su escalado, x su punto débil)
  var idTope = ecosIdEntidad(ent), t = ECOS_TOPE[idTope], tV2 = ECOS_TOPE_V2[idTope];
  if (tV2) {
    // Anexo 16 §2.3 + Anexo 15 §3.1 (aprobado por Cha 20-nov 14:37, camino B), UN jefe primero: tope por golpe DURO = 10 % de la
    // vida vigente (ya trae el escalado) x punto débil; tope por segundo BLANDO con umbral = vida vigente / (T_objetivo/2) y la
    // curva de dos tramos (F1/K2/F2). b[1] acumula lo INTENTADO. Con F1 = F2 = 0 vuelve a ser un tope duro.
    try {
      var vv = Math.max(1, ent.getMaxHealth());
      var v2 = Math.floor(Date.now() / 1000), b2 = _ecosVentana.get(ent);
      if (!b2 || b2[0] != v2) { b2 = [v2, 0]; _ecosVentana.put(ent, b2); }
      var antes2 = e.getAmount();
      var porGolpe = Math.min(antes2, ECOS_TOPE_GOLPE_FR * vv * pdM);
      var umbral = vv / (tV2 / 2) * pdM, raw = b2[1];
      var curva = function (x) {
        if (x <= umbral) return x;
        var q2 = umbral * ECOS_TOPE_K2;
        if (x <= q2) return umbral + (x - umbral) * ECOS_TOPE_F1;
        return umbral + (q2 - umbral) * ECOS_TOPE_F1 + (x - q2) * ECOS_TOPE_F2;
      };
      var permitido = Math.max(0, curva(raw + porGolpe) - curva(raw));
      b2[1] = raw + porGolpe;
      if (permitido < antes2) e.setAmount(permitido);
    } catch (errV2) { console.info('[ECOS-FORGE] tope v2: ' + errV2); }
  } else if (t) {
    try {
      var mt = Math.max(1, ecosNum(ent.persistentData, 'ecos_esc_tope')) * pdM;
      var v = Math.floor(Date.now() / 1000), b = _ecosVentana.get(ent);
      if (!b || b[0] != v) { b = [v, 0]; _ecosVentana.put(ent, b); }
      var antes = e.getAmount();
      var ok = Math.max(0, Math.min(antes, t[0] * mt, t[1] * mt - b[1]));
      b[1] += ok;
      if (ok < antes) e.setAmount(ok);
    } catch (err) { console.info('[ECOS-FORGE] tope: ' + err); }
  }
  // c) estamina: que te peguen y pegar cuerpo a cuerpo
  try {
    var dmg = pdBase !== null ? pdBase : e.getAmount();   // el tiro letal no cuesta toda la estamina
    if (ecosEsJugador(ent) && atq && !ecosEsJugador(atq)) ecosCansar(ent, dmg * ECOS_EST.recibir);   // golpe de una criatura (caídas y fuego no)
    if (ecosEsJugador(atq) && tipo.split(':').pop() == 'player' && atq !== ent) {
      var tk = Number(atq.level.getGameTime()), g = _ecosGolpes.get(atq);
      if (!g || g[0] != tk) { _ecosGolpes.put(atq, [tk, 0]); ecosCansar(atq, dmg * ECOS_EST.golpe); }
      else if (g[1] < ECOS_EST.extraMax) { g[1] += ECOS_EST.extra; ecosCansar(atq, ECOS_EST.extra); }
    }
  } catch (errC) {}
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.ShieldBlockEvent', function (e) {
  // S10b: Flecha que Cruza el Vacío -> el escudo del blanco no bloquea el disparo (y entonces no cuesta estamina bloquear)
  try {
    var s = e.getDamageSource ? e.getDamageSource() : null, a = s ? s.getEntity() : null, d = ecosDirecta(s);
    if (ecosEsJugador(a) && d && d !== a && ecosUN() && ecosUnicosEnMano(a).flecha) { e.setCanceled(true); return; }
  } catch (errF) {}
  try { var p = e.getEntity(); if (ecosEsJugador(p)) ecosCansar(p, Number(e.getBlockedDamage()) * ECOS_EST.escudo); } catch (err) {}
});
// v12.2 (Cha, 18-nov 06:11: "un botón o una tecla, sin escribir en el chat"): Shift + F abre la ventana del Sistema
// (ecos_misiones_v2.js). Solo servidor, sin zip: la F (cambiar de mano) ya manda su paquete al servidor y Forge dispara
// LivingSwapItemsEvent$Hands (forge 47.4.28, verificado en el jar); con Shift se cancela el cambio de mano y se abre la ventana.
// S10b: Flecha que Cruza el Vacío (el escudo no bloquea) · Colmillo que Vuelve (el disparo que falla devuelve 1 flecha, 1 cada 3 s)
// · Cetro de los Siete Escudos (al lanzar un hechizo PERMITIDO: OnCast no llega si el PreCast de Era lo canceló)
ForgeEvents.onEvent('net.minecraftforge.event.entity.ProjectileImpactEvent', function (e) {
  try {
    var pr = e.getProjectile(), o = pr ? pr.getOwner() : null;
    if (!ecosEsJugador(o) || o.level.isClientSide()) return;
    if (String(e.getRayTraceResult().getType()) != 'BLOCK' || !ecosUnicosEnMano(o).colmillo) return;
    var UN = ecosUN(), ahora = Date.now(), t0 = _ecosColmillo.get(o);
    if (!UN || (t0 && ahora - t0 < UN.colmilloCadaMs)) return;
    _ecosColmillo.put(o, ahora);
    o.server.runCommandSilent('give ' + o.username + ' minecraft:arrow 1');
  } catch (err) {}
});
ForgeEvents.onEvent('io.redspace.ironsspellbooks.api.events.SpellOnCastEvent', function (e) {
  try {
    var p = e.getEntity();
    if (!ecosEsJugador(p) || p.level.isClientSide() || !ecosUnicosEnMano(p).cetro) return;
    var UN = ecosUN(), ahora = Date.now(), t0 = _ecosCetro.get(p);
    if (!UN || (t0 && ahora - t0 < UN.cetroCadaMs)) return;
    _ecosCetro.put(p, ahora);
    p.potionEffects.add('minecraft:absorption', UN.cetroTicks, 0, false, true);
  } catch (err) {}
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingSwapItemsEvent$Hands', function (e) {
  try {
    var p = e.getEntity();
    if (!ecosEsJugador(p) || p.level.isClientSide()) return;
    if (p.isShiftKeyDown()) {
      e.setCanceled(true);
      // 20-nov 21:04 (Cha: «Shift+F me sigue abriendo la interfaz vieja… no se puede cerrar con Esc»): abre el ARCHIVO VIVO
      // (ecos_archivo.js + FancyMenu, pestañas aprobadas el 19-nov), ya no la ventana vieja de VNDialog (zykna mv menu).
      p.server.runCommandSilent('execute as ' + p.username + ' run zykna av');
      return;
    }
    // 18-nov: Ctrl + F → stats (el cliente avisa si tiene Ctrl apretado: server_scripts/ecos_teclas.js)
    var T = global.ecosTeclas;
    if (T && T.ctrl(String(p.username))) {
      e.setCanceled(true);
      T.abrir(p.server, String(p.username));
    }
  } catch (err) {}
});
ForgeEvents.onEvent('net.minecraftforge.event.entity.player.ArrowLooseEvent', function (e) {
  try { var p = e.getEntity(); if (ecosEsJugador(p) && e.hasAmmo()) ecosCansar(p, ECOS_EST.flecha); } catch (err) {}
});

// --- Iron's: hechizos por Era al lanzar ---
var ECOS_HECHIZO_ERA = { 'irons_spellbooks:teleport': 2, 'irons_spellbooks:recall': 2, 'irons_spellbooks:portal': 2 };
var ECOS_RAREZA_ERA = { 'EPIC': 3, 'LEGENDARY': 4 };
var ECOS_ERA_NOMBRE = ['', 'ERA I', 'ERA II', 'ERA III', 'ERA IV'];
var ECOS_SPELLS = null;
try { ECOS_SPELLS = Java.loadClass('io.redspace.ironsspellbooks.api.registry.SpellRegistry'); } catch (e) { console.info('[ECOS-FORGE] sin SpellRegistry: ' + e); }

function ecosEraJugador(p) {
  var t = p.getTags();
  for (var i = 4; i >= 1; i--) if (t.contains('ecos_era' + i)) return i;
  return 0;
}

ForgeEvents.onEvent('io.redspace.ironsspellbooks.api.events.SpellPreCastEvent', function (e) {
  try {
    var p = e.getEntity(), id = String(e.getSpellId()), req = ECOS_HECHIZO_ERA[id] || 0;
    var escuela = '';
    try { escuela = String(e.getSchoolType().getId()); } catch (x) {}
    if (escuela == 'irons_spellbooks:holy' && req < 2) req = 2;
    if (ECOS_SPELLS) {
      var sp = ECOS_SPELLS.getSpell(id);
      if (sp) {
        var r = ECOS_RAREZA_ERA[String(sp.getRarity(e.getSpellLevel()).name())] || 0;
        if (r > req) req = r;
      }
    }
    if (req && ecosEraJugador(p) < req) {
      e.setCanceled(true);
      try { p.tell(Text.red('Ese hechizo todavía no responde: requiere ' + ECOS_ERA_NOMBRE[req] + '.')); } catch (m) {}
    }
  } catch (err) { console.info('[ECOS-FORGE] hechizo: ' + err); }
});

// --- Mutant Monsters (Anexo 14, Cha 20-nov «todo como lo recomiendas», DECIDE 5): la Chemical X (convierte mobs en mutantes)
// queda SOLO por comando, para los asedios. El mod la registra por código (PotionBrewingRegistry: poción base + cráneo de
// esqueleto mutante; javap de fuzs/mutantmonsters/MutantMonsters), así que no hay receta de datapack que quitar. Si un
// soporte de pociones la produce, se vuelve poción Rara (awkward) en el mismo momento: el cráneo se gasta y la Chemical X no sale.
var ECOS_PU = null, ECOS_POTS = null, ECOS_FREG = null;
ForgeEvents.onEvent('net.minecraftforge.event.brewing.PotionBrewEvent$Post', function (e) {
  try {
    if (!ECOS_PU) {
      ECOS_PU = Java.loadClass('net.minecraft.world.item.alchemy.PotionUtils');
      ECOS_POTS = Java.loadClass('net.minecraft.world.item.alchemy.Potions');
      ECOS_FREG = Java.loadClass('net.minecraftforge.registries.ForgeRegistries');
    }
    for (var i = 0; i < e.getLength(); i++) {
      var st = e.getItem(i);
      if (!st || st.isEmpty()) continue;
      var k = ECOS_FREG.POTIONS.getKey(ECOS_PU.getPotion(st));
      if (k && String(k) == 'mutantmonsters:chemical_x') {
        ECOS_PU.setPotion(st, ECOS_POTS.AWKWARD);
        console.info('[ECOS-FORGE] Chemical X en soporte de pociones -> poción Rara (solo por comando)');
      }
    }
  } catch (err) { console.info('[ECOS-FORGE] pociones: ' + err); }
});

// --- Book of Dragons (Anexo 14, DECIDE 3b): volar es una llave que se gana (regla de oro, ECOS-modpack-diseno.md:69-70).
// 9 de las 10 especies vuelan (data/bookofdragons/fauna/species/*.json: movement.AIR con valor; el Speed Stinger no).
// Sin la marca de su Maestro (etapa ecos_maestro_<familia>_g2, la misma que abre volar en los poderes) no se montan los que
// vuelan. Domar (es con comida), alimentar y ordenarles no se toca; el Speed Stinger se monta libre.
// Ajuste a la recomendación del Estudio (decía solo ecos_maestro_impulso_g2): esa marca SOLO la puede ganar quien es de la
// familia Impulso (ecos_maestros.js:134-149), y así el resto nunca volaría. Vale la marca de CUALQUIER Maestro.
var ECOS_DRAGON_VUELA = { 'bookofdragons:deadlynadder': 1, 'bookofdragons:gronckle': 1, 'bookofdragons:hideous_zippleback': 1,
  'bookofdragons:hobgobbler': 1, 'bookofdragons:monstrousnightmare': 1, 'bookofdragons:nightfury': 1, 'bookofdragons:skrill': 1,
  'bookofdragons:terrible_terror': 1, 'bookofdragons:whispering_death': 1 };
var ECOS_FAMS_MARCA = ['bestias', 'elementales', 'sangre', 'mente', 'materia', 'espiritu', 'impulso'];
function ecosTieneMarca(p) {
  for (var i = 0; i < ECOS_FAMS_MARCA.length; i++) {
    var et = 'ecos_maestro_' + ECOS_FAMS_MARCA[i] + '_g2';
    try { if (p.stages.has(et)) return true; } catch (e1) {}
    try { if (p.persistentData.getBoolean(et)) return true; } catch (e2) {}   // persistentData de KubeJS (la que escribe ecos_maestros.js)
  }
  return false;
}
var ECOS_CLS_JUG = null, ECOS_CLS_ET = null;
ForgeEvents.onEvent('net.minecraftforge.event.entity.EntityMountEvent', function (e) {
  try {
    if (!e.isMounting()) return;
    if (!ECOS_CLS_JUG) {
      ECOS_CLS_JUG = Java.loadClass('net.minecraft.server.level.ServerPlayer');   // solo del lado del servidor
      ECOS_CLS_ET = Java.loadClass('net.minecraft.world.entity.EntityType');
    }
    var p = e.getEntityMounting(), m = e.getEntityBeingMounted();
    if (!p || !m || !(p instanceof ECOS_CLS_JUG)) return;   // (Rhino: Java.loadClass no trae isInstance; level es propiedad, no función)
    var tipo = String(ECOS_CLS_ET.getKey(m.getType()));
    if (!ECOS_DRAGON_VUELA[tipo] || ecosTieneMarca(p)) return;
    e.setCanceled(true);
    console.info('[ECOS-FORGE] dragón sin marca: ' + p.getGameProfile().getName() + ' no monta ' + tipo);
    try { p.displayClientMessage(Text.gold('Este dragón vuela: para montarlo necesitas la marca de tu Maestro.'), true); } catch (m2) {}
  } catch (err) { console.info('[ECOS-FORGE] dragón: ' + err); }
});

// --- Cliente: Enhanced Celestials abre "¡Ya llegó Enhanced Celestials 2!" en CADA inicio de sesión y no trae opción
// para apagarlo (EC2AnnouncementTrigger.onLogin pone pending=true sin revisar config; javap 16-nov). Se cancela al abrirse.
try {
  ForgeEvents.onEvent('net.minecraftforge.client.event.ScreenEvent$Opening', function (e) {
    try {
      if (String(e.getNewScreen()).indexOf('EC2AnnouncementScreen') >= 0) e.setCanceled(true);
    } catch (err) {}
  });
} catch (e) { console.info('[ECOS-FORGE] sin pantalla de cliente (servidor dedicado): ' + e); }

console.info('[ECOS-FORGE] topes de jefes (con escalado), poder con stats, estamina relativa y hechizos por Era cargados');
