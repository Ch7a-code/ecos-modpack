// ECOS · items del Núcleo de Conciencia (uno por Era). Solo se AGREGAN items: seguro para mundos existentes.
StartupEvents.registry('item', event => {
  for (var i = 1; i <= 4; i++) {
    event.create('nucleo_era' + i).displayName('Núcleo de Conciencia ' + ['I', 'II', 'III', 'IV'][i - 1])
      .texture('minecraft:item/nether_star').glow(true).rarity('epic').maxStackSize(1)
  }
  // S10 + S10b (Estudio 20-nov, aprobado por Cha): los 3 únicos de jefe PROPIOS (los otros 7 son ítems del pool con NBT).
  // Daño del tooltip = attackDamageBaseline (3, por defecto de la espada) + bono del tier + 1 -> 9 / 11 / 15 · 1.6 ataques/s.
  // OJO (javap, S10b §3): speed() es velocidad de MINADO; la de ataque es speedBaseline (-2.4 = 1.6/s).
  // Pasivas: startup_scripts/ecos_forge.js (LivingHurtEvent) con números de server_scripts/ecos_botin_estilo.js.
  var UNICOS = [
    ['ecos:filo_primer_centinela', 'Filo del Primer Centinela', 5.0, 600, 2, 14],
    ['ecos:puno_que_no_se_enfria', 'Puño que No se Enfría', 7.0, 900, 3, 15],
    ['ecos:garra_marea_honda', 'Garra de la Marea Honda', 11.0, 1600, 4, 15]
  ];
  UNICOS.forEach(function (u) {
    event.create(u[0], 'sword').displayName(u[1]).texture('ecos:item/' + u[0].split(':')[1])
      .attackDamageBonus(u[2]).speedBaseline(-2.4).maxDamage(u[3]).rarity('epic')
      .modifyTier(function (t) { t.setLevel(u[4]); t.setEnchantmentValue(u[5]); });
  });
})
