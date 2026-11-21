// priority: 100
// ECOS v12.x · ANEXO 13: AFINIDADES DE DAÑO E INMUNIDADES CON SENTIDO DE LORE (aprobado por Cha 20-nov 06:57-06:58).
// ARRANQUE (startup): cambiar este archivo pide REINICIAR; /reload no lo vuelve a leer. Solo var (Rhino).
//
// QUÉ HACE. Cada golpe de un JUGADOR a una criatura se clasifica en categorías (filo, contundente, flecha, arma de fuego, blaster,
// magia por escuela, poder de Echoes, cosmos, explosión...) y la familia de la criatura (tabla AFN_FAMILIAS) lo multiplica:
// resiste (x0.5), débil (x1.5) o inmune (x0, solo donde el lore lo justifica). Inmunidad total = daño 0 + el evento se cancela
// y el jugador ve por qué (barra, partícula, sonido y, la primera vez por familia, un susurro de Zykna).
//
// ORDEN (Anexo 15 §3.2: "las afinidades van ANTES del tope de daño"). Este archivo trae su PROPIO LivingHurtEvent y debe correr
// antes que el de ecos_forge.js. Dos mecanismos, los dos verificados con javap en kubejs-forge-2001.6.5 / eventbus-6.2.33:
//  1) "// priority: 100" arriba: ScriptManager ordena los scripts por prioridad DESCENDENTE (ScriptFile.compareTo) y todos los demás
//     tienen 0, así que este archivo se evalúa primero en cualquier sistema de archivos (el orden alfabético NO es garantía en el host).
//  2) ForgeEventWrapper.onEvent registra con EventPriority.NORMAL fijo (KubeJS 6 no deja elegir) y el EventBus guarda los
//     listeners de una misma prioridad en un ArrayList en ORDEN DE REGISTRO. Evaluado primero = registrado primero = corre primero.
// La inmunidad usa setCanceled(true): el de ecos_forge.js (receiveCancelled=false) ya no corre. Por eso un tiro a la cabeza
// "letal" de ecos_puntos_debiles.js (que fija el daño con setAmount) NO puede saltarse una inmunidad.
//
// LO QUE NO TOCA. ecos_forge.js (el tope), ecos_jefes_fases.js (sus afinidades de jefe son el atributo magic_resist de Iron's: se
// reusa global.ecosJefesFases.afinidades SOLO para las fuentes que NO son de Iron's, con el mismo +-15 %; las de Iron's ya van por
// el atributo y no se duplican). Nada por tick: un solo mapa por golpe, O(1).
// Números = SUPOSICIÓN hasta simularlos con ttk.py por categoría (Anexo 13 §5). Todo cambio de números es SOLO esta tabla.

var AFN_ON = true;
var AFN_JEFE_VALOR = 0.15;      // = JF_AFIN_VALOR de ecos_jefes_fases.js:14
var AFN_AVISO_MS = 400;         // pausa entre avisos al mismo jugador (no saturar la barra en un barrido)
var AFN_NS_COSMOS = 'saint_seiya_nouvelle_generation';
var AFN_NS_SW = 'star_wars_expansion';
var AFN_TAG_FRACTURA = 'ecos_b7_grieta';   // ecos_bunker7.js:509: las criaturas que salen de las grietas de la Fractura

var AFN_MONSTER = null;
try { AFN_MONSTER = Java.loadClass('net.minecraft.world.entity.monster.Monster'); } catch (eAfnM) { console.info('[ECOS-AFIN] sin clase Monster: ' + eAfnM); }

// Nombre para el jugador de cada categoría
var AFN_NOMBRE = {
  filo: 'filo', contundente: 'golpes contundentes', perforante: 'perforantes', desarmado: 'puños', melee: 'cuerpo a cuerpo',
  flecha: 'flechas', arrojadiza: 'arrojadizas', blaster: 'blásters', distancia: 'ataques a distancia', armas_fuego: 'armas de fuego',
  explosion: 'explosiones', poder: 'poderes de Echoes', cosmos: 'cosmos', magia: 'magia',
  fuego: 'fuego', hielo: 'hielo', rayo: 'rayo', sagrado: 'sagrado', ender: 'ender', sangre: 'sangre', evocacion: 'evocación',
  naturaleza: 'naturaleza', eldritch: 'eldritch'
};
// Escuelas de Iron's (id corto) <-> elemento en español. Mismos ids que JF_ESCUELA de ecos_jefes_fases.js.
var AFN_ESC = { fire: 'fuego', ice: 'hielo', lightning: 'rayo', holy: 'sagrado', ender: 'ender', blood: 'sangre',
  evocation: 'evocacion', nature: 'naturaleza', eldritch: 'eldritch' };
var AFN_ELEMENTOS = {};
Object.keys(AFN_ESC).forEach(function (k) { AFN_ELEMENTOS[AFN_ESC[k]] = true; });
// Poderes de Echoes con elemento claro (data/eop/damage_type del jar); el resto cuenta solo como "poder".
var AFN_EOP_ELEM = { ice: 'hielo', shock: 'rayo', blood: 'sangre' };

// ------------------------------------------------------------------------------------------------ TABLA DE FAMILIAS
// m: categoría -> multiplicador. 0 = inmune. La primera categoría de la lista del golpe que esté en m manda; si ninguna, x1.
//   Lista de un golpe (de lo específico a lo general): filo -> ['filo','melee'] · flecha -> ['flecha','distancia'] ·
//   Iron's fuego -> ['fuego','magia'] · poder con hielo -> ['hielo','poder'] · cosmos -> ['cosmos'] · TaCZ -> ['armas_fuego'].
// razon: lo que Zykna dice la primera vez y la barra repite cuando es inmune.
// match: ids (lista exacta) | ns + monster + excluye (regex sobre el id) | fn(id) | tag (etiqueta de la entidad, se mira por golpe)
var AFN_FAMILIAS = {
  // Fractura: nacen del Eco roto (Anexo 13 §2b). Etiqueta HECHO (ecos_bunker7.js:509).
  fractura: { n: 'Criatura de la Fractura', tag: AFN_TAG_FRACTURA,
    razon: 'Nació del Eco roto: las armas normales apenas la rozan.',
    m: { melee: 0.5, distancia: 0.5, armas_fuego: 0.5, poder: 1.5, cosmos: 1.5 } },
  // Saint Seiya: INMUNES a armas de fuego y espadas normales; los hiere el cosmos, los poderes y la magia (§2b).
  // Familia = enemigo (clase Monster) del mod. Excluye lo que por nombre no es un caballero con Cloth (esqueletos, espíritus,
  // fantasmas, civiles): esos quedan SIN afinidad (neutro) hasta que guardian-canon revise la lista. INFERENCIA.
  cloth: { n: 'Caballero con Cloth', ns: AFN_NS_COSMOS, monster: true, excluye: /squelet|spirit|ghost|:ames?(_|de|squel)|civ|illusion/,
    razon: 'Solo el cosmos hiere a un caballero con armadura.',
    m: { armas_fuego: 0, filo: 0, contundente: 0.5, perforante: 0.5, desarmado: 0.5, flecha: 0.5, arrojadiza: 0.5, blaster: 0.5,
      cosmos: 1.5, poder: 1.5, magia: 1.5 } },
  // Star Wars Expansion: Jedi/Sith desvían proyectiles y blásters (resisten distancia); débiles a cuerpo a cuerpo y poderes.
  // Ids HECHO (tools/indice_ids.json); que 'shaak' sea Jedi es INFERENCIA por el nombre.
  jedi_sith: { n: 'Jedi o Sith', ids: ['star_wars_expansion:ancient_sith_lord', 'star_wars_expansion:shaak'],
    razon: 'Desvía proyectiles y blásters con su sable.',
    m: { flecha: 0.5, arrojadiza: 0.5, blaster: 0.5, armas_fuego: 0.5, melee: 1.5, poder: 1.5 } },
  // Droides y máquinas: resisten filo; caen con rayo/ion y golpes contundentes.
  droide: { n: 'Droide', fn: function (id) { return id.indexOf(AFN_NS_SW + ':') == 0 && /droid|t_3_m_4|atst/.test(id); },
    razon: 'El filo no atraviesa su chasis.',
    m: { filo: 0.5, rayo: 1.5, contundente: 1.5 } },
  // Dinosaurios de piel dura (ids HECHO en indice_ids.json): resisten filo y flechas; los hieren lo contundente, el fuego de
  // armas, los explosivos y los poderes.
  dinosaurio: { n: 'Dinosaurio de piel dura',
    ids: ['alexscaves:tremorsaurus', 'alexscaves:atlatitan', 'alexscaves:grottoceratops', 'alexscaves:luxtructosaurus', 'alexscaves:relicheirus'],
    razon: 'Su piel y sus placas desvían el filo y las flechas.',
    m: { filo: 0.5, flecha: 0.5, contundente: 1.5, armas_fuego: 1.5, explosion: 1.5, poder: 1.5 } },
  // Alien adaptado a su mundo (Ad Astra). Solo el caso que el nombre deja claro: el carnero glacian es de un planeta helado.
  // Los demás (Marte, Mercurio, la Luna, Venus) esperan decisión de lore: sin afinidad.
  alien_hielo: { n: 'Criatura de un mundo helado', ids: ['ad_astra:glacian_ram'],
    razon: 'Vive en un mundo helado: el frío no le hace nada.',
    m: { hielo: 0.5, fuego: 1.5, armas_fuego: 1.25 } },
  // Ejemplos de §2 (no-muertos, golems de metal, criaturas de fuego). Ids vanilla HECHO (indice_ids.json).
  no_muerto: { n: 'No-muerto',
    ids: ['minecraft:zombie', 'minecraft:husk', 'minecraft:drowned', 'minecraft:zombie_villager', 'minecraft:skeleton', 'minecraft:stray',
      'minecraft:wither_skeleton', 'minecraft:phantom'],
    razon: 'Lo sagrado y los golpes que rompen hueso le duelen más.',
    m: { sagrado: 1.5, contundente: 1.5 } },
  golem_metal: { n: 'Gólem de metal', ids: ['minecraft:iron_golem'],
    razon: 'Es de hierro: el rayo lo sobrecarga y el filo resbala.',
    m: { rayo: 1.5, filo: 0.5 } },
  fuego: { n: 'Criatura de fuego', ids: ['minecraft:blaze', 'minecraft:magma_cube'],
    razon: 'Está hecha de calor: el hielo la apaga.',
    m: { hielo: 1.5, fuego: 0.5 } }
};
// Orden fijo de revisión (la etiqueta primero, luego por tipo)
var AFN_ORDEN = ['fractura', 'cloth', 'jedi_sith', 'droide', 'dinosaurio', 'alien_hielo', 'no_muerto', 'golem_metal', 'fuego'];
var AFN_POR_ID = {};     // id exacto -> id de familia (lo de 'ids')
AFN_ORDEN.forEach(function (k) { var f = AFN_FAMILIAS[k]; if (f.ids) f.ids.forEach(function (i) { if (!AFN_POR_ID[i]) AFN_POR_ID[i] = k; }); });
var _afnCache = {};      // id -> id de familia o '' (la clase y el nombre no cambian por entidad)
var _afnAviso = {};      // jugador -> ms del último aviso

function afnLog(m) { console.info('[ECOS-AFIN] ' + m); }

// ------------------------------------------------------------------------------------------------ BÚSQUEDA
function afnJug(x) { try { return !!x && x.isPlayer(); } catch (e) { return false; } }
function afnId(ent) {
  try { var s = ent.getEncodeId(); if (s) return String(s); } catch (e) {}
  try { return String(ent.type); } catch (e2) {}
  return '';
}
function afnNs(id) { var i = id.indexOf(':'); return i > 0 ? id.substring(0, i) : ''; }
function afnBuscar(ent, id) {
  if (AFN_POR_ID[id]) return AFN_POR_ID[id];
  for (var i = 0; i < AFN_ORDEN.length; i++) {
    var f = AFN_FAMILIAS[AFN_ORDEN[i]];
    if (f.fn) { try { if (f.fn(id)) return AFN_ORDEN[i]; } catch (e) {} }
    else if (f.ns && afnNs(id) == f.ns) {
      if (f.monster) { var esM = false; try { esM = !!AFN_MONSTER && (ent instanceof AFN_MONSTER); } catch (e2) {} if (!esM) continue; }
      if (f.excluye && f.excluye.test(id)) continue;
      return AFN_ORDEN[i];
    }
  }
  return '';
}
// familia de la criatura (objeto) o null. La etiqueta de la Fractura se mira por entidad; el resto se cachea por id.
function afnFamiliaDe(ent, id) {
  try {
    var tg = ent.getTags();
    if (tg && tg.contains(AFN_TAG_FRACTURA)) return AFN_FAMILIAS.fractura;
  } catch (e) {}
  var c = _afnCache[id];
  if (c === undefined) { c = afnBuscar(ent, id); _afnCache[id] = c; }
  return c ? AFN_FAMILIAS[c] : null;
}

// ------------------------------------------------------------------------------------------------ CLASIFICAR EL GOLPE
function afnTipo(src) {
  var reg = '', msg = '';
  try { reg = String(src.typeHolder().unwrapKey().get().location()); } catch (e1) {}
  try { msg = String(src.getType()); } catch (e2) {}   // KubeJS renombra getMsgId -> getType
  if (!msg || msg == 'undefined' || msg == 'null') { try { msg = String(src.getMsgId()); } catch (e3) {} }
  return [reg == 'undefined' || reg == 'null' ? '' : reg, msg == 'undefined' || msg == 'null' ? '' : msg];
}
// entidad directa del golpe (la flecha/el proyectil; en cuerpo a cuerpo es el propio jugador). Mismos respaldos que ecos_forge.js.
// quien causó el golpe: KubeJS renombra DamageSource.getEntity() a getActual() (javap DamageSourceMixin). Prueba 20-nov 21:45:
// 'Cannot find function getEntity in object DamageSource'.
function afnAtacante(s) {
  if (!s) return null;
  try { var a = s.getActual(); if (a) return a; } catch (e1) {}
  try { var a2 = s.actual; if (a2) return a2; } catch (e2) {}
  try { return s.getEntity(); } catch (e3) {}
  return null;
}
function afnDirecta(s) {
  if (!s) return null;
  try { var d = s.getImmediate(); if (d) return d; } catch (e1) {}
  try { var d2 = s.immediate; if (d2) return d2; } catch (e2) {}
  return null;
}
// Arma en la mano principal -> sub-tipo de golpe cuerpo a cuerpo. Por NOMBRE de ítem (los mods no exponen un tipo): INFERENCIA.
// Lo que no se reconoce cuenta como 'desarmado' (resiste poco, nunca inmune por equivocación).
function afnArma(atq) {
  try {
    var st = atq.mainHandItem;
    if (!st || st.isEmpty()) return ['desarmado', 'melee'];
    var id = String(st.id).split(':').pop();
    if (/hammer|mace|club|maul|flail|pickaxe|shovel|hoe|stick|knuckle|gauntlet|fist|staff|cane|puno/.test(id)) return ['contundente', 'melee'];
    if (/spear|lance|trident|rapier|pike|javelin|dagger|knife|halberd|garra|colmillo/.test(id)) return ['perforante', 'melee'];
    if (/sword|axe|blade|saber|katana|claymore|cutlass|scimitar|sickle|scythe|machete|glaive|cleaver|filo/.test(id)) return ['filo', 'melee'];
  } catch (e) {}
  return ['desarmado', 'melee'];
}
// Devuelve { tags: [...], deIrons: bool } o null (sin categoría = sin afinidad)
function afnTags(src, atq) {
  var t = afnTipo(src), reg = t[0], msg = t[1];
  var pre = reg ? afnNs(reg) : '', path = reg ? reg.substring(reg.indexOf(':') + 1) : msg;
  var d = afnDirecta(src), dId = '', dNs = '';
  if (d && d !== atq) { dId = afnId(d); dNs = afnNs(dId); }
  // proyectiles de mods: mandan sobre el tipo de daño (los de MCreator no traen tipo propio)
  if (dNs == AFN_NS_COSMOS) return { tags: ['cosmos'], deIrons: false };
  if (dNs == AFN_NS_SW) {
    if (dId.indexOf('detonator') >= 0) return { tags: ['explosion'], deIrons: false };
    if (dId.indexOf('laser') >= 0) return { tags: ['blaster', 'distancia'], deIrons: false };
  }
  if (pre == 'eop' || pre == 'palladium') {
    var el = AFN_EOP_ELEM[path];
    return { tags: el ? [el, 'poder'] : ['poder'], deIrons: false };
  }
  if (pre == 'tacz') return { tags: ['armas_fuego'], deIrons: false };
  if (pre == 'irons_spellbooks') {
    var m = /^(\w+)_magic$/.exec(path), ee = m ? AFN_ESC[m[1]] : null;
    return { tags: ee ? [ee, 'magia'] : ['magia'], deIrons: true };
  }
  if (pre == 'ars_nouveau') {
    return { tags: path == 'frost' ? ['hielo', 'magia'] : path == 'flare' ? ['fuego', 'magia'] : ['magia'], deIrons: false };
  }
  if (pre == 'attributeslib') {
    if (path == 'fire_damage') return { tags: ['fuego'], deIrons: false };
    if (path == 'cold_damage') return { tags: ['hielo'], deIrons: false };
  }
  if (reg == 'tombstone:holy') return { tags: ['sagrado'], deIrons: false };
  if (reg == 'cataclysm:lightning') return { tags: ['rayo'], deIrons: false };
  if (path == 'explosion' || path == 'player_explosion' || (pre == 'supplementaries' && /explosion/.test(path))) return { tags: ['explosion'], deIrons: false };
  if (reg == 'minecraft:arrow' || (!reg && msg == 'arrow')) return { tags: ['flecha', 'distancia'], deIrons: false };
  if (reg == 'minecraft:trident' || reg == 'minecraft:thrown' || reg == 'quark:pickarang' || (!reg && (msg == 'trident' || msg == 'thrown'))) return { tags: ['arrojadiza', 'distancia'], deIrons: false };
  if (path == 'player_attack' || msg == 'player') return { tags: afnArma(atq), deIrons: false };
  return null;
}

// ------------------------------------------------------------------------------------------------ MULTIPLICADOR
function afnMult(m, tags) {      // primera categoría de la lista que esté en la tabla; si ninguna, 1
  if (!m) return 1;
  for (var i = 0; i < tags.length; i++) if (m[tags[i]] !== undefined) return m[tags[i]];
  return 1;
}
function afnCategoriaDe(m, tags) {   // cuál categoría mandó (para el aviso)
  if (m) for (var i = 0; i < tags.length; i++) if (m[tags[i]] !== undefined) return tags[i];
  return tags[0];
}
// Devuelve { m, cat, fam, jefe } con m = multiplicador total (1 = nada)
function afnResolver(fam, A, gt) {
  var tags = gt.tags, r = { m: 1, cat: tags[0], fam: fam, jefe: false };
  if (fam) { r.m = afnMult(fam.m, tags); r.cat = afnCategoriaDe(fam.m, tags); }
  // Jefes con escuela (global.ecosJefesFases.afinidades): las de Iron's ya van por el atributo; aquí las demás fuentes del mismo elemento.
  if (A && !gt.deIrons) {
    for (var i = 0; i < tags.length; i++) {
      if (!AFN_ELEMENTOS[tags[i]]) continue;
      if (AFN_ESC[A[0]] == tags[i]) { r.m *= 1 + AFN_JEFE_VALOR; r.cat = tags[i]; r.jefe = true; }
      else if (AFN_ESC[A[1]] == tags[i]) { r.m *= 1 - AFN_JEFE_VALOR; r.cat = tags[i]; r.jefe = true; }
      break;
    }
  }
  return r;
}

// ------------------------------------------------------------------------------------------------ AVISO AL JUGADOR
function afnNum(x) { return String(Math.round(x * 100) / 100); }
function afnAvisar(atq, ent, r) {
  var n = null, srv = null;
  try { n = String(atq.username); } catch (e1) {}
  if (!n || n == 'undefined') return;
  var ahora = Date.now();
  if (_afnAviso[n] && ahora - _afnAviso[n] < AFN_AVISO_MS) return;
  _afnAviso[n] = ahora;
  try { srv = atq.server; } catch (e2) {}
  if (!srv) { try { srv = atq.getServer(); } catch (e3) {} }
  if (!srv) return;
  var cat = AFN_NOMBRE[r.cat] || r.cat, txt, color, snd, part, cnt;
  if (r.m <= 0) { txt = 'Inmune a ' + cat + (r.fam ? '. ' + r.fam.razon : ''); color = 'red'; snd = 'minecraft:item.shield.block 0.8 0.8'; part = 'minecraft:smoke'; cnt = 12; }
  else if (r.m > 1) { txt = 'Débil a ' + cat + ' ×' + afnNum(r.m); color = 'gold'; snd = 'minecraft:entity.arrow.hit_player 0.5 1.4'; part = 'minecraft:enchanted_hit'; cnt = 8; }
  else { txt = 'Resiste ' + cat + ' ×' + afnNum(r.m); color = 'gray'; snd = 'minecraft:block.anvil.place 0.3 1.6'; part = 'minecraft:smoke'; cnt = 3; }
  try {
    srv.runCommandSilent('title ' + n + ' actionbar ' + JSON.stringify({ text: '✦ ' + txt, color: color, bold: true }));
    srv.runCommandSilent('execute as ' + n + ' at @s run playsound ' + snd.split(' ')[0] + ' player @s ~ ~ ~ ' + snd.split(' ')[1] + ' ' + snd.split(' ')[2]);
    srv.runCommandSilent('execute at ' + n + ' run particle ' + part + ' ' + afnNum(ent.x) + ' ' + afnNum(ent.y + 1) + ' ' + afnNum(ent.z) + ' 0.3 0.4 0.3 0.02 ' + cnt);
  } catch (eC) { afnLog('aviso: ' + eC); }
  // Primera vez por familia: Zykna lo explica una sola vez (estado del jugador con prefijo propio)
  if (r.fam) {
    var k = 'ecos_afn_vio_' + r.famId;
    try {
      if (!atq.persistentData.getBoolean(k)) {
        atq.persistentData.putBoolean(k, true);
        var H = global.ecosHUD, t2 = r.fam.n + ': ' + r.fam.razon;
        if (!(H && H.susurro(srv, n, 'zona', t2))) srv.runCommandSilent('title ' + n + ' actionbar ' + JSON.stringify({ text: t2, color: 'aqua' }));
      }
    } catch (eZ) { afnLog('susurro: ' + eZ); }
  }
}

// ------------------------------------------------------------------------------------------------ VALIDACIÓN (Anexo 13 §2)
// Una inmunidad total solo vale si quedan >= 2 de las 7 grandes categorías con x1 o más (un jugador con un solo estilo no se traba).
var AFN_GRUPOS_PRUEBA = {
  melee: [['filo', 'melee'], ['contundente', 'melee'], ['perforante', 'melee'], ['desarmado', 'melee']],
  distancia: [['flecha', 'distancia'], ['arrojadiza', 'distancia'], ['blaster', 'distancia']],
  armas_fuego: [['armas_fuego']],
  magia: [['fuego', 'magia'], ['hielo', 'magia'], ['rayo', 'magia'], ['sagrado', 'magia'], ['ender', 'magia'], ['sangre', 'magia'],
    ['evocacion', 'magia'], ['naturaleza', 'magia'], ['eldritch', 'magia']],
  poder: [['poder']], cosmos: [['cosmos']], explosion: [['explosion']]
};
function afnGruposQueFuncionan(m) {
  var ok = [];
  Object.keys(AFN_GRUPOS_PRUEBA).forEach(function (g) {
    var hay = AFN_GRUPOS_PRUEBA[g].some(function (tags) { return afnMult(m, tags) >= 1; });
    if (hay) ok.push(g);
  });
  return ok;
}
function afnValidar() {
  var problemas = [];
  Object.keys(AFN_FAMILIAS).forEach(function (k) {
    var f = AFN_FAMILIAS[k], inmune = false;
    Object.keys(f.m).forEach(function (c) { if (f.m[c] <= 0) inmune = true; });
    if (!inmune) return;
    if (!f.razon) problemas.push(k + ': inmunidad sin razón de lore');
    var ok = afnGruposQueFuncionan(f.m);
    if (ok.length < 2) {
      problemas.push(k + ': inmunidad con solo ' + ok.length + ' categoría(s) que funciona(n)');
      Object.keys(f.m).forEach(function (c) { if (f.m[c] <= 0) f.m[c] = 0.25; });   // red de seguridad: nunca trabar al jugador
    }
  });
  return problemas;
}
var AFN_PROBLEMAS = afnValidar();
AFN_PROBLEMAS.forEach(function (p) { afnLog('VALIDACIÓN: ' + p); });

// ------------------------------------------------------------------------------------------------ EL GOLPE
ForgeEvents.onEvent('net.minecraftforge.event.entity.living.LivingHurtEvent', function (e) {
  try {
    if (!AFN_ON) return;
    var ent = e.getEntity(), src = e.getSource(), atq = afnAtacante(src);
    if (!atq || !afnJug(atq) || afnJug(ent) || atq === ent) return;
    var id = afnId(ent), fam = afnFamiliaDe(ent, id), A = null;
    try { var JF = global.ecosJefesFases && global.ecosJefesFases.afinidades; A = JF ? (JF[id] || null) : null; } catch (eJ) {}
    if (!fam && !A) return;
    var gt = afnTags(src, atq);
    if (!gt) return;
    var r = afnResolver(fam, A, gt);
    if (fam) r.famId = fam === AFN_FAMILIAS.fractura ? 'fractura' : _afnCache[id];
    if (r.m == 1) return;
    if (r.m <= 0) {
      e.setAmount(0);
      afnAvisar(atq, ent, r);
      e.setCanceled(true);   // ecos_forge.js ya no corre: ni punto débil letal, ni tope, ni estamina
      return;
    }
    e.setAmount(e.getAmount() * r.m);
    afnAvisar(atq, ent, r);
  } catch (err) { console.info('[ECOS-AFIN] golpe: ' + err); }
});

// API para quien la quiera leer (Jade, Bestiario del Códice, ficha de preparación): solo lectura de la tabla.
global.ecosAfinidades = {
  familias: AFN_FAMILIAS,
  familiaDe: afnFamiliaDe,
  etiquetas: afnTags,
  mult: afnMult,
  resolver: afnResolver,
  gruposQueFuncionan: afnGruposQueFuncionan,
  problemas: AFN_PROBLEMAS,
  // lineas legibles de una familia: { debil: [...], resiste: [...], inmune: [...], razon }
  resumen: function (famId) {
    var f = AFN_FAMILIAS[famId];
    if (!f) return null;
    var o = { debil: [], resiste: [], inmune: [], razon: f.razon || '' };
    Object.keys(f.m).forEach(function (c) {
      var v = f.m[c], t = (AFN_NOMBRE[c] || c);
      if (v <= 0) o.inmune.push(t); else if (v > 1) o.debil.push(t + ' ×' + afnNum(v)); else if (v < 1) o.resiste.push(t + ' ×' + afnNum(v));
    });
    return o;
  }
};
afnLog('cargado: ' + AFN_ORDEN.length + ' familias, ' + (AFN_PROBLEMAS.length ? AFN_PROBLEMAS.length + ' problema(s) de validación' : 'validación OK') + ' (prioridad 100: corre antes que ecos_forge.js)');
