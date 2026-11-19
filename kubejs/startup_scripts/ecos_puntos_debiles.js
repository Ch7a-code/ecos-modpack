// ECOS v12.2 · PUNTOS DÉBILES (Cha 18-nov 21:2x: "si yo le doy al zombie en la cabeza también lo mato de una, los mobs también
// deberían tener ese daño" · 21:38: "los jefes, que tengan sus puntos vulnerables: la cabeza, los brazos, sus ojos, dependiendo
// del jefe o monstruo"). Es el espejo de lo que ya pasa con los jugadores (First Aid: tiro a la cabeza = muerte, salvo casco).
//  - DÓNDE PEGÓ. Flecha, bala o proyectil: el cruce de su trayectoria con la caja de la criatura. Cuerpo a cuerpo: la mira del
//    jugador (si la mira no toca a la criatura, como en el barrido de la espada, no hay punto débil).
//  - CRIATURA NORMAL (vida máx. < PD_GRANDE y no es jefe): en la cabeza = muerte. Con casco puesto: x2 (como el jugador).
//  - JEFES y criaturas grandes: nunca de un golpe. Su punto débil (PD_JEFES) multiplica el daño, y ecos_forge.js sube su tope de
//    daño por golpe en la misma proporción (si no, el punto débil no serviría contra ellos). Sin entrada: la cabeza x2.
//  - TaCZ ya multiplica sus balas en la cabeza: en jefes no se vuelve a multiplicar la cabeza (sí los otros puntos).
//  - Aviso al tirador: el "ding" del tiro, el texto en la barra y chispas donde pegó.
// Lo llama ecos_forge.js (LivingHurtEvent) con global.ecosPD.evaluar. Rhino: solo var; los métodos de Mojang se prueban en orden
// y se anota cuál sirvió (como guGiro de ecos_lab_guia.js: getYRot no existe para Rhino).

var PD_ON = true, PD_GRANDE = 100, PD_AVISO_MS = 250;
var PD_PI = 3.141592653589793;   // 18-nov: PD_PI sale NaN en el Rhino de KubeJS (medido en server/v12)
// Prueba local (server/v12): kubejs/config/ecos_pd_prueba.json {"prueba":true} -> un proyectil sin dueño cuenta como de jugador.
var PD_PRUEBA = false;
try { var _pdCfg = JsonIO.read('kubejs/config/ecos_pd_prueba.json'); if (_pdCfg && String(_pdCfg.prueba) == 'true') PD_PRUEBA = true; } catch (ePc) {}

// Zonas en coordenadas de la caja: y = altura (0 pies .. 1 coronilla) · f = adelante (+1 la cara, -1 la espalda) · s = de lado
// (|s| >= sa: los costados, donde van los brazos). y0 'ojo' = desde un poco abajo de los ojos (la cabeza de un humanoide).
var PD_CABEZA = { n: 'cabeza', y0: 'ojo' };
var PD_FRENTE = { n: 'cabeza', f0: 0.4, y0: 0.3 };
var PD_PLANES = {
  humano: [PD_CABEZA],
  frente: [PD_FRENTE],
  ninguno: []
};
// Criaturas con la cabeza al frente y no arriba (cuadrúpedos, arañas, voladores con cara). Las de mods sin lista: si son más
// anchas que altas, también al frente; si no, humanoide.
var PD_FRENTE_IDS = {};
['spider', 'cave_spider', 'wolf', 'pig', 'cow', 'mooshroom', 'sheep', 'horse', 'donkey', 'mule', 'skeleton_horse', 'zombie_horse',
  'llama', 'trader_llama', 'hoglin', 'zoglin', 'ravager', 'polar_bear', 'panda', 'goat', 'camel', 'sniffer', 'fox', 'ocelot', 'cat',
  'rabbit', 'chicken', 'turtle', 'silverfish', 'endermite', 'phantom', 'bee', 'ghast', 'guardian', 'elder_guardian', 'strider', 'frog',
  'axolotl', 'dolphin', 'parrot'].forEach(function (k) { PD_FRENTE_IDS['minecraft:' + k] = true; });
var PD_SIN_CABEZA = {};
['slime', 'magma_cube', 'shulker', 'bat', 'squid', 'glow_squid', 'cod', 'salmon', 'pufferfish', 'tropical_fish', 'tadpole']
  .forEach(function (k) { PD_SIN_CABEZA['minecraft:' + k] = true; });
// Nunca: maniquíes, aldeanos y comerciantes (un tiro perdido no debe costar un aldeano), NPCs y colonos.
var PD_FUERA = { 'minecraft:armor_stand': 1, 'minecraft:villager': 1, 'minecraft:wandering_trader': 1 };
var PD_FUERA_NS = ['easy_npc:', 'minecolonies:'];

// Jefes: zonas con su multiplicador (m). [] = el mod ya trae su punto débil (no se toca).
var PD_JEFES = {
  'mowziesmobs:ferrous_wroughtnaut': [{ n: 'espalda', f1: -0.35, m: 2 }],                  // la pista de su expedición: "pégale por la espalda"
  'mowziesmobs:frostmaw': [{ n: 'cara', f0: 0.3, y0: 0.55, m: 2 }, { n: 'brazo', y0: 0.2, y1: 0.6, sa: 0.6, m: 1.5 }],
  'mowziesmobs:sculptor': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'twilightforest:naga': [{ n: 'cabeza', f0: 0.2, m: 2 }],
  'twilightforest:lich': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'twilightforest:snow_queen': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'twilightforest:armored_giant': [{ n: 'cabeza', y0: 'ojo', m: 2 }, { n: 'brazo', y0: 0.4, y1: 0.75, sa: 0.6, m: 1.5 }],
  'twilightforest:hydra': [],                                                               // sus cabezas son piezas aparte (Twilight Forest)
  'minecraft:ender_dragon': [],                                                             // vanilla: la cabeza recibe el golpe completo
  'minecraft:wither': [{ n: 'cabezas', y0: 0.62, m: 2 }],
  'cataclysm:netherite_monstrosity': [{ n: 'cabeza', y0: 0.72, m: 2 }, { n: 'brazo', y0: 0.3, y1: 0.72, sa: 0.6, m: 1.5 }],
  'cataclysm:ignis': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'cataclysm:the_harbinger': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'cataclysm:the_leviathan': [{ n: 'ojos', f0: 0.4, y0: 0.3, m: 2 }],
  'cataclysm:maledictus': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'cataclysm:ender_golem': [{ n: 'cabeza', y0: 'ojo', m: 2 }, { n: 'brazo', y0: 0.3, y1: 0.7, sa: 0.6, m: 1.5 }],
  'cataclysm:the_prowler': [{ n: 'ojo', f0: 0.4, y0: 0.4, m: 2 }],
  'cataclysm:wadjet': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'cataclysm:aptrgangr': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'aether:valkyrie_queen': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'alexscaves:tremorsaurus': [{ n: 'cabeza', f0: 0.4, y0: 0.45, m: 2 }],
  'deeperdarker:stalker': [{ n: 'cabeza', y0: 'ojo', m: 2 }],
  'iceandfire:fire_dragon': [{ n: 'cabeza', f0: 0.45, y0: 0.35, m: 2 }],
  'iceandfire:ice_dragon': [{ n: 'cabeza', f0: 0.45, y0: 0.35, m: 2 }],
  'iceandfire:lightning_dragon': [{ n: 'cabeza', f0: 0.45, y0: 0.35, m: 2 }],
  'iceandfire:cyclops': [{ n: 'ojo', y0: 'ojo', f0: 0, m: 3 }],                              // el ojo del cíclope
  'iceandfire:gorgon': [{ n: 'cabeza', y0: 'ojo', m: 2 }]
};
var PD_JEFE_DEF = [{ n: 'cabeza', y0: 'ojo', m: 2 }];

var PD_PROJ = null;
try { PD_PROJ = Java.loadClass('net.minecraft.world.entity.projectile.Projectile'); } catch (eP) {}
var _pdForma = {}, _pdAviso = {}, _pdN = 0;

function pdLog(m) { console.info('[ECOS-PD] ' + m); }
var _pdDbgN = 0;
function pdDbg(m) { if (PD_PRUEBA && _pdDbgN++ < 40) pdLog('prueba · ' + m); }
function pdPos(e) {   // [x, y, z] de una entidad
  return pdForma('posicion', [function (x) { var a = [pdNum(x.x), pdNum(x.y), pdNum(x.z)]; return a[0] === null ? null : a; },
    function (x) { var b = [pdNum(x.getX()), pdNum(x.getY()), pdNum(x.getZ())]; return b[0] === null ? null : b; },
    function (x) { var c = [pdNum(x.m_20185_()), pdNum(x.m_20186_()), pdNum(x.m_20189_())]; return c[0] === null ? null : c; }], e, false);
}
function pdNum(v) { if (v === null || v === undefined) return null; var n = Number(v); return isFinite(n) ? n : null; }
// Primera forma que da un valor; se anota cuál sirvió (una vez).
function pdForma(nombre, formas, x, esNum) {
  var i0 = _pdForma[nombre];
  if (i0 >= 0) { try { var v0 = formas[i0](x); if (esNum ? pdNum(v0) !== null : (v0 !== null && v0 !== undefined)) return esNum ? pdNum(v0) : v0; } catch (e0) {} }
  for (var i = 0; i < formas.length; i++) {
    try {
      var v = formas[i](x);
      if (esNum ? pdNum(v) !== null : (v !== null && v !== undefined)) {
        if (_pdForma[nombre] !== i) { _pdForma[nombre] = i; pdLog('forma de ' + nombre + ': ' + i); }
        return esNum ? pdNum(v) : v;
      }
    } catch (e) {}
  }
  if (_pdForma[nombre] !== -1) { _pdForma[nombre] = -1; pdLog('sin forma para ' + nombre); }
  return null;
}
function pdVec(v) {
  if (!v) return null;
  var r = null;
  try { r = [pdNum(v.x()), pdNum(v.y()), pdNum(v.z())]; } catch (e) {}
  if (!r || r[0] === null) { try { r = [pdNum(v.x), pdNum(v.y), pdNum(v.z)]; } catch (e2) {} }
  return r && r[0] !== null && r[1] !== null && r[2] !== null ? r : null;
}
function pdId(e) {
  try { var s = e.getEncodeId(); if (s) return String(s); } catch (x) {}
  try { return String(e.type); } catch (x2) {}
  return '';
}
function pdMismo(a, b) { try { return !!a && !!b && (a === b || a.equals(b)); } catch (e) { return false; } }
function pdAncho(e) { return pdForma('ancho', [function (x) { return x.getBbWidth(); }, function (x) { return x.bbWidth; }, function (x) { return x.m_20205_(); }, function (x) { return x.getType().getWidth(); }], e, true); }
function pdAlto(e) { return pdForma('alto', [function (x) { return x.getBbHeight(); }, function (x) { return x.bbHeight; }, function (x) { return x.m_20206_(); }, function (x) { return x.getType().getHeight(); }], e, true); }
function pdOjos(e) { return pdForma('ojos', [function (x) { return x.getEyeHeight(); }, function (x) { return x.eyeHeight; }, function (x) { return x.m_20192_(); }, function (x) { return x.getEyeY() - x.y; }], e, true); }
function pdGiro(e) {   // giro del cuerpo (grados de Minecraft: 0 = mira al sur)
  return pdForma('giro', [function (x) { return x.yBodyRot; }, function (x) { return x.f_20883_; }, function (x) { return x.getYRot(); }, function (x) { return x.m_146908_(); }, function (x) { return x.getVisualRotationYInDegrees(); },
    function (x) { return x.yHeadRot; }, function (x) { return x.getYHeadRot(); },
    function (x) { var v = pdVec(x.getLookAngle()); return v ? Math.atan2(-v[0], v[2]) * 180 / PD_PI : null; }], e, true);
}
function pdVel(d) {
  var v = pdForma('velocidad', [function (x) { var m = [pdNum(x.motionX), pdNum(x.motionY), pdNum(x.motionZ)]; return m[0] === null ? null : m; },
    function (x) { return pdVec(x.getDeltaMovement()); }, function (x) { return pdVec(x.deltaMovement); }, function (x) { return pdVec(x.m_20184_()); }], d, false);
  return v;
}
function pdMira(p) { return pdForma('mira', [function (x) { return pdVec(x.getLookAngle()); }, function (x) { return pdVec(x.lookAngle); }, function (x) { return pdVec(x.m_20154_()); },
  function (x) { return pdVec(x.getViewVector(1.0)); }], p, false); }
function pdVida(e) { return pdForma('vida', [function (x) { return x.getHealth(); }, function (x) { return x.health; }, function (x) { return x.m_21223_(); }], e, true); }
function pdVidaMax(e) { return pdForma('vidaMax', [function (x) { return x.getMaxHealth(); }, function (x) { return x.maxHealth; }, function (x) { return x.m_21233_(); }], e, true); }
function pdCasco(e) {   // ¿trae algo en la cabeza?
  var it = pdForma('casco', [function (x) { return x.getHeadArmorItem(); }, function (x) { return x.headArmorItem; },
    function (x) { return x.getItemBySlot(Java.loadClass('net.minecraft.world.entity.EquipmentSlot').HEAD); }], e, false);
  if (!it) return false;
  try { return !it.isEmpty(); } catch (e1) {}
  try { return String(it.id) != 'minecraft:air'; } catch (e2) {}
  return false;
}
function pdDomado(e) { try { return !!e.isTame(); } catch (x) { return false; } }

// Cruce de un rayo o + t·d (t en [0, tmax]) con la caja b = [x0,y0,z0,x1,y1,z1]. Devuelve t de entrada o null.
function pdRayo(o, d, b, tmax) {
  var t0 = 0, t1 = tmax;
  for (var k = 0; k < 3; k++) {
    var lo = b[k], hi = b[k + 3];
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo || o[k] > hi) return null; continue; }
    var a = (lo - o[k]) / d[k], c = (hi - o[k]) / d[k];
    if (a > c) { var tt = a; a = c; c = tt; }
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return null;
  }
  return t0;
}
// Punto del golpe -> coordenadas de la caja {y, f, s}. c = [x, y, z] de los pies, w/h = ancho/alto, giro en grados (o null).
function pdRelativo(pt, c, w, h, giro) {
  var r = { y: Math.max(0, Math.min(1, (pt[1] - c[1]) / h)), f: null, s: null };
  if (giro !== null) {
    var g = giro * PD_PI / 180, fx = -Math.sin(g), fz = Math.cos(g), dx = pt[0] - c[0], dz = pt[2] - c[2], m = Math.max(0.05, w / 2);
    r.f = (dx * fx + dz * fz) / m;
    r.s = (dx * -fz + dz * fx) / m;
    if (PD_PRUEBA) pdDbg('relativo g ' + g + ' fx ' + fx + ' fz ' + fz + ' dx ' + dx + ' dz ' + dz + ' m ' + m + ' pt ' + pt + ' c ' + c);
  }
  return r;
}
function pdEnZona(z, r, ojoRel) {
  var y0 = z.y0 === 'ojo' ? Math.max(0.62, Math.min(0.85, ojoRel - 0.12)) : (z.y0 || 0);
  if (r.y < y0 || r.y > (z.y1 === undefined ? 1 : z.y1)) return false;
  if (z.f0 !== undefined || z.f1 !== undefined) {
    if (r.f === null) return false;
    if (z.f0 !== undefined && r.f < z.f0) return false;
    if (z.f1 !== undefined && r.f > z.f1) return false;
  }
  if (z.sa !== undefined && (r.s === null || Math.abs(r.s) < z.sa)) return false;
  return true;
}
// Zonas que aplican a esta criatura y si es "grande" (jefe o vida máx. >= PD_GRANDE).
function pdZonasDe(id, w, h, esJefe, vidaMax) {
  if (PD_JEFES.hasOwnProperty(id)) return { zonas: PD_JEFES[id], grande: true };
  var grande = !!esJefe || (vidaMax !== null && vidaMax >= PD_GRANDE);
  if (PD_SIN_CABEZA[id]) return { zonas: [], grande: grande };
  var frente = PD_FRENTE_IDS[id] || (id.indexOf('minecraft:') != 0 && w !== null && h !== null && w >= h);
  var base = frente ? [PD_FRENTE] : [PD_CABEZA];
  if (grande) return { zonas: [{ n: 'cabeza', y0: base[0].y0, f0: base[0].f0, m: 2 }], grande: true };
  return { zonas: base, grande: false };
}

// Punto del golpe en el mundo, o null si no se puede saber. d = entidad directa (proyectil o el mismo jugador).
function pdPunto(ent, d, atq, tipo, w, h) {
  var c = pdPos(ent);
  if (!c) return null;
  var caja = [c[0] - w / 2, c[1], c[2] - w / 2, c[0] + w / 2, c[1] + h, c[2] + w / 2];
  var melee = (!d || pdMismo(d, atq)) && /(^|:)player(_attack)?$/.test(tipo);
  if (melee) {
    var mira = pdMira(atq), oj = pdOjos(atq);
    if (!mira) return null;
    var pa = pdPos(atq);
    if (!pa) return null;
    var o = [pa[0], pa[1] + (oj === null ? 1.62 : oj), pa[2]];
    var t = pdRayo(o, mira, [caja[0] - 0.1, caja[1] - 0.1, caja[2] - 0.1, caja[3] + 0.1, caja[4] + 0.1, caja[5] + 0.1], 7);
    if (t === null) return null;   // barrido de espada u otro golpe que no apuntó a esta criatura
    return [o[0] + mira[0] * t, o[1] + mira[1] * t, o[2] + mira[2] * t];
  }
  if (!d || pdMismo(d, atq) || /explos|firework|fireball|sonic/.test(tipo)) return null;
  if (PD_PROJ && !/^tacz:/.test(tipo)) { try { if (!(d instanceof PD_PROJ)) return null; } catch (eI) {} }   // la bala de TaCZ pasa siempre
  var p0 = pdPos(d), v = pdVel(d);
  if (!p0) return null;
  if (v && (v[0] || v[1] || v[2])) {
    var t2 = pdRayo(p0, v, [caja[0] - 0.3, caja[1] - 0.3, caja[2] - 0.3, caja[3] + 0.3, caja[4] + 0.3, caja[5] + 0.3], 2);
    if (t2 !== null) return [p0[0] + v[0] * t2, p0[1] + v[1] * t2, p0[2] + v[2] * t2];
  }
  return [Math.max(caja[0], Math.min(caja[3], p0[0])), Math.max(caja[1], Math.min(caja[4], p0[1])), Math.max(caja[2], Math.min(caja[5], p0[2]))];
}

// Si Rhino no deja leer el proyectil del daño: el proyectil más cercano a la criatura (a 4 bloques), de ese tirador si se sabe.
var PD_AABB = Java.loadClass('net.minecraft.world.phys.AABB');
function pdProyectilCerca(ent, atq) {
  var c = pdPos(ent);
  if (!c || !PD_PROJ) return null;
  var L = null;
  try { L = ent.level.getEntitiesWithin(new PD_AABB(c[0] - 4, c[1] - 4, c[2] - 4, c[0] + 4, c[1] + 6, c[2] + 4)); } catch (e) { return null; }
  var mejor = null, dm = 1e9;
  for (var i = 0; L && i < L.size(); i++) {
    var x = L.get(i);
    try { if (!(x instanceof PD_PROJ)) continue; } catch (e1) { continue; }
    if (atq) { var du = null; try { du = x.getOwner(); } catch (e2) { try { du = x.owner; } catch (e3) {} } if (du && !pdMismo(du, atq)) continue; }
    var q = pdPos(x);
    if (!q) continue;
    var dd = (q[0] - c[0]) * (q[0] - c[0]) + (q[1] - c[1]) * (q[1] - c[1]) + (q[2] - c[2]) * (q[2] - c[2]);
    if (dd < dm) { dm = dd; mejor = x; }
  }
  return mejor;
}

// LO QUE LLAMA ecos_forge.js. Devuelve null (nada) o { zona, mult, letal, casco, jefe, punto }.
function pdEvaluar(ent, src, atq, tipo, monto, esJefe) {
  if (!PD_ON || !ent) return null;
  var id = pdId(ent);
  if (PD_FUERA[id]) return null;
  for (var i = 0; i < PD_FUERA_NS.length; i++) if (id.indexOf(PD_FUERA_NS[i]) == 0) return null;
  try { if (ent.getTags().contains('ecos_zykna') || ent.getTags().contains('ecos_museo_tmp')) return null; } catch (eT) {}
  if (pdDomado(ent)) return null;
  var d = pdForma('directa', [function (x) { return x.getImmediate(); }, function (x) { return x.immediate; }, function (x) { return x.getDirectEntity(); },
    function (x) { return x.directEntity; }, function (x) { return x.m_7640_(); }], src, false);
  if (!d && !/(^|:)player(_attack)?$/.test(String(tipo || ''))) d = pdProyectilCerca(ent, atq);   // 18-nov: Rhino no ve getDirectEntity
  var jugador = false;
  try { jugador = !!atq && atq.isPlayer(); } catch (eJ) {}
  pdDbg(id + ' · directa ' + (d ? pdId(d) || 'sí' : 'NINGUNA') + ' · jugador ' + jugador + ' · tipo ' + tipo);
  if (!jugador && !(PD_PRUEBA && !atq && d)) return null;
  var w = pdAncho(ent), h = pdAlto(ent);
  if (w === null || h === null || h <= 0) return null;
  var info = pdZonasDe(id, w, h, esJefe, pdVidaMax(ent));
  if (!info.zonas.length) return null;
  var pt = jugador ? pdPunto(ent, d, atq, String(tipo || ''), w, h) : pdPunto(ent, d, null, 'prueba', w, h);
  if (!pt) { pdDbg(id + ' · sin punto de golpe'); return null; }
  var cEnt = pdPos(ent), giroEnt = pdGiro(ent);
  var r = pdRelativo(pt, cEnt, w, h, giroEnt);
  pdDbg(id + ' giro ' + giroEnt + ' (' + typeof giroEnt + ') · centro ' + cEnt + ' · ancho ' + w + ' (' + typeof w + ')');
  pdDbg(id + ' punto ' + pt.map(function (q) { return q.toFixed(2); }).join(',') + ' · y ' + r.y.toFixed(2) + ' f ' + r.f + ' · zonas ' + info.zonas.length + (info.grande ? ' grande' : ''));
  var oj = pdOjos(ent), ojoRel = oj === null ? 0.85 : oj / h;
  for (var k = 0; k < info.zonas.length; k++) {
    var z = info.zonas[k];
    if (!pdEnZona(z, r, ojoRel)) continue;
    var res = { zona: z.n, mult: 1, letal: 0, casco: false, jefe: info.grande, punto: pt, rel: r, id: id };
    if (!info.grande) {
      res.casco = pdCasco(ent);
      if (res.casco) res.mult = 2;
      else { var vida = pdVida(ent); res.letal = Math.max(Number(monto) || 0, ((vida === null ? 40 : vida) + 50) * 10); }
    } else {
      res.mult = z.m || 2;
      if (/^tacz:/.test(String(tipo)) && /cabeza|cara|ojo/.test(z.n)) res.mult = 1;   // TaCZ ya multiplicó su bala en la cabeza
    }
    if (res.mult <= 1 && !res.letal) return null;
    pdAvisar(atq, res);
    return res;
  }
  return null;
}

function pdAvisar(atq, res) {
  _pdN++;
  if (_pdN <= 40 || _pdN % 100 == 0) pdLog('#' + _pdN + ' ' + res.id + ' · ' + res.zona + (res.letal ? ' · MUERTE' : ' x' + res.mult) + (res.casco ? ' (casco)' : '') +
    ' · y ' + res.rel.y.toFixed(2) + (res.rel.f === null ? '' : ' f ' + res.rel.f.toFixed(2) + ' s ' + res.rel.s.toFixed(2)) + (atq ? '' : ' · prueba'));
  if (!atq) return;
  var n = null, srv = null;
  try { n = String(atq.username); } catch (e1) {}
  if (!n || n == 'undefined') { try { n = String(atq.getGameProfile().getName()); } catch (e2) { return; } }
  var ahora = Date.now();
  if (_pdAviso[n] && ahora - _pdAviso[n] < PD_AVISO_MS) return;
  _pdAviso[n] = ahora;
  srv = pdForma('servidor', [function (x) { return x.getServer(); }, function (x) { return x.server; }, function (x) { return x.m_20194_(); }, function (x) { return x.level.getServer(); }], atq, false);
  if (!srv) return;
  var txt = res.letal ? '✦ ¡Tiro a la cabeza!' : res.jefe ? '✦ Punto débil: ' + res.zona + ' ×' + res.mult : '✦ Cabeza con casco ×' + res.mult;
  var color = res.letal ? 'gold' : res.jefe ? 'light_purple' : 'gray';
  var p = res.punto.map(function (v) { return v.toFixed(2); }).join(' ');
  try {
    srv.runCommandSilent('title ' + n + ' actionbar ' + JSON.stringify({ text: txt, color: color, bold: true }));
    srv.runCommandSilent('execute as ' + n + ' at @s run playsound minecraft:entity.arrow.hit_player player @s ~ ~ ~ 0.6 ' + (res.letal ? '1.3' : '1.0'));
    srv.runCommandSilent('execute at ' + n + ' run particle minecraft:crit ' + p + ' 0.15 0.15 0.15 0.25 ' + (res.letal ? 14 : 8));
  } catch (eC) { pdLog('aviso: ' + eC); }
}

global.ecosPD = { evaluar: pdEvaluar, jefes: PD_JEFES, prueba: PD_PRUEBA,
  _f: { rayo: pdRayo, relativo: pdRelativo, enZona: pdEnZona, zonasDe: pdZonasDe, punto: pdPunto } };
pdLog('cargado: puntos débiles (criatura normal: cabeza = muerte, con casco x2 · ' + Object.keys(PD_JEFES).length + ' jefes con su punto débil)' + (PD_PRUEBA ? ' · MODO PRUEBA' : ''));
