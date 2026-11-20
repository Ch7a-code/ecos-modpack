// ECOS · nuestras texturas SIEMPRE ENCIMA de cualquier pack de texturas (Cha 19-nov: «que se sobreponga siempre nuestros
// diseños sobre cualquier pack de texturas»).
// Por qué: KubeJS mete kubejs/assets DEBAJO del primer pack .zip del jugador (GeneratedClientResourcePack.inject, javap
// 19-nov), así que un pack de texturas tapaba inventario, cofres, diálogos, misiones FTB y mochilas.
// Cómo: se registra kubejs/ como pack de recursos FIJO ARRIBA (Pack.create con Position.TOP y fixedPosition = true; firmas
// leídas del jar de Forge 47.4.28): obligatorio, no se puede quitar ni bajar en la pantalla de packs.
// El menú de inicio y el Archivo (FancyMenu) no dependen de esto: se leen de config/ y ningún pack los tapa.
(function () {
  try {
    var Pack = Java.loadClass('net.minecraft.server.packs.repository.Pack');
    var Info = Java.loadClass('net.minecraft.server.packs.repository.Pack$Info');
    var Position = Java.loadClass('net.minecraft.server.packs.repository.Pack$Position');
    var PackType = Java.loadClass('net.minecraft.server.packs.PackType');
    var PackSource = Java.loadClass('net.minecraft.server.packs.repository.PackSource');
    var PathPackResources = Java.loadClass('net.minecraft.server.packs.PathPackResources');
    var Component = Java.loadClass('net.minecraft.network.chat.Component');
    var FFS = Java.loadClass('net.minecraft.world.flag.FeatureFlagSet');
    var raiz = Java.loadClass('dev.latvian.mods.kubejs.KubeJSPaths').DIRECTORY;   // kubejs/ (su assets/ es el pack)
    ForgeModEvents.onEvent('net.minecraftforge.event.AddPackFindersEvent', function (e) {
      if (String(e.getPackType()) != 'CLIENT_RESOURCES') return;
      e.addRepositorySource(function (alta) {
        var info = new Info(Component.literal('Inventario, cofres, diálogos y misiones de ECOS: van encima de cualquier pack'), 15, FFS.of());
        var pack = Pack.create('ecos_interfaz', Component.literal('ECOS · Interfaz (siempre encima)'), true,
          function (nombre) { return new PathPackResources(nombre, raiz, true); }, info, PackType.CLIENT_RESOURCES, Position.TOP, true, PackSource.BUILT_IN);
        alta.accept(pack);
      });
    });
    console.info('[ECOS-PACK] interfaz de ECOS registrada como pack fijo arriba (' + raiz + ')');
  } catch (e) { console.info('[ECOS-PACK] no se pudo registrar el pack fijo: ' + e); }
})();
