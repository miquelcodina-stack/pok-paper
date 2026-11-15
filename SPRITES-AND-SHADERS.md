# Cobblemon sprites and shader directory

Poképaper's Cobblemon view indexes every PNG in the upstream community sprite archive at [BeubeuReturns/cobblemon_sprites](https://github.com/BeubeuReturns/cobblemon_sprites). The snapshot used here contains 2,176 PNGs, grouped into 1,089 Pokémon/form entries, including standard and shiny images where present. The upstream snapshot commit is c7c327ee3c2b8825284353d3bbe32dd505ed3033 (2026-10-17).

Images are hot-linked from the upstream repository's immutable commit URL rather than copied into this repository. The archive is community-maintained and is not an official Cobblemon asset feed. Pokémon names, models and related artwork remain the property of their respective rights holders.

To refresh the index after the upstream repository changes, run:

```sh
node scripts/sync-cobblemon-sprites.mjs
```

Then commit the generated `cobblemon-sprites.json` and redeploy. The script follows the upstream default branch and pins image URLs to the newest commit.

The shader directory links to the creators' Modrinth project pages. Check each project's current Minecraft version, mod loader, renderer and hardware requirements before using it.
