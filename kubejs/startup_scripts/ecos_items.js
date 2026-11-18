// ECOS · items del Núcleo de Conciencia (uno por Era). Solo se AGREGAN items: seguro para mundos existentes.
StartupEvents.registry('item', event => {
  for (let i = 1; i <= 4; i++) {
    event.create('nucleo_era' + i).displayName('Núcleo de Conciencia ' + ['I', 'II', 'III', 'IV'][i - 1])
      .texture('minecraft:item/nether_star').glow(true).rarity('epic').maxStackSize(1)
  }
})
