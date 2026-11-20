// ECOS · colores de texto ANIMADOS (Cha 19-nov: "animación a los textos… dorado o neón… en las cosas importantes").
// Placebo (ya viene con Apotheosis) trae GradientColor: un TextColor con nombre cuyo valor avanza por una lista de colores,
// un paso por tick (20 por segundo). Se registra en TextColor.NAMED_COLORS, así que cualquier texto con "color": "ecos_oro"
// brilla solo: chat, títulos, ventanas de diálogo, nombres de objetos. Corre en servidor y cliente (startup).
// API verificada con javap (19-nov): new GradientColor(int[] colores, String nombre, float velocidad) ·
// PlaceboUtil.registerCustomColor(TextColor). Si Placebo falta, global.ecosColorVivo queda vacío y los scripts usan hex fijo.
global.ecosColorVivo = {};
(function () {
  function degradado(claves, pasos) {   // claves: [[rgb, peso], ...] en ciclo; pasos = ticks que dura la vuelta
    var tot = 0, out = [];
    claves.forEach(function (k) { tot += k[1]; });
    for (var i = 0; i < pasos; i++) {
      var t = i / pasos * tot, acc = 0;
      for (var j = 0; j < claves.length; j++) {
        var w = claves[j][1];
        if (t < acc + w || j == claves.length - 1) {
          var a = claves[j][0], b = claves[(j + 1) % claves.length][0], u = Math.min(1, (t - acc) / w);
          var r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * u);
          var g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * u);
          var bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * u);
          out.push((r << 16) | (g << 8) | bl);
          break;
        }
        acc += w;
      }
    }
    return out;
  }
  var COLORES = {
    // oro que destella: reposo oro, un brillo corto casi blanco y vuelve (2.4 s)
    ecos_oro: [[[0xE5B43A, 5], [0xF3D27A, 1], [0xFFF1C0, 1], [0xF3D27A, 1], [0xE5B43A, 4], [0xC8952A, 3]], 48],
    // neón del sistema: cian ↔ magenta (3 s)
    ecos_neon: [[[0x19E6E6, 4], [0x8C83CC, 1], [0xFF1FB3, 4], [0x8C83CC, 1]], 60],
    // conciencia: cian que respira hacia blanco (2 s)
    ecos_cian: [[[0x19E6E6, 1], [0xD8FCFC, 1]], 40],
    // magenta que respira (2 s)
    ecos_magenta: [[[0xFF1FB3, 1], [0xFF9FDC, 1]], 40]
  };
  try {
    var GC = Java.loadClass('dev.shadowsoffire.placebo.color.GradientColor');
    var PU = Java.loadClass('dev.shadowsoffire.placebo.util.PlaceboUtil');
    Object.keys(COLORES).forEach(function (n) {
      PU.registerCustomColor(new GC(degradado(COLORES[n][0], COLORES[n][1]), n, 1.0));
      global.ecosColorVivo[n] = n;
    });
    console.info('[ECOS-COLOR] colores animados: ' + Object.keys(global.ecosColorVivo).join(', '));
  } catch (e) { console.info('[ECOS-COLOR] sin Placebo o sin GradientColor: ' + e); }
})();
