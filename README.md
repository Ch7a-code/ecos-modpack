# ECOS · Ecos de la Conciencia

**Página de descarga con instrucciones: https://ch7a-code.github.io/ecos-modpack/**

Modpack de Minecraft 1.20.1 (Forge 47.4.28) para jugar en el servidor del grupo.
**Se actualiza solo:** cada vez que abres el juego compara tu modpack con este repo, baja lo nuevo y borra lo que se quitó.

## Instalar (una sola vez)

1. Descarga e instala **Prism Launcher**: https://prismlauncher.org/download/
2. Ábrelo e inicia sesión con tu cuenta de Microsoft (la de Minecraft).
3. **Add Instance → Import** y pega este link:
   `https://github.com/Ch7a-code/ecos-modpack/releases/latest/download/ECOS-Prism.zip`
4. Dale **Launch**. La primera vez tarda (baja todo el modpack); las siguientes, solo lo que cambió.

Memoria: el modpack ya viene con 10 GB. Si tu PC tiene 16 GB o menos y se traba, bájala a 8 GB en
*Edit → Settings → Java*.

## Qué pasa cuando hay actualización

Nada que hacer: cierra el juego y vuelve a abrirlo. Antes de arrancar aparece una ventanita que baja los cambios.

Además, en cada arranque se aplican los **ajustes obligatorios** (por ejemplo, apagar las nubes de Distant Horizons). Solo esos;
lo demás de tu configuración se respeta.

Funciona en **Windows** (el actualizador usa PowerShell). Si alguna vez falla, abre *Edit → Settings → Custom commands* y revisa
que el comando de antes de abrir siga así:
`powershell -NoProfile -ExecutionPolicy Bypass -File ecos-actualizar.ps1 "$INST_JAVA"`

¿Algo falla en el juego o hay lag? Escribe en el chat `reporte` y qué pasa.
