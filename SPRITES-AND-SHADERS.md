# Cobblemon assets and wallpaper shaders

Cobblemon model sprites are an **asset style inside the existing Pokémon wallpaper editor**. Select a Pokémon, open its **Asset style** menu, and choose **Cobblemon model sprites** when that species/form is present in the bundled archive. Normal and shiny images are offered when the archive contains both. These are static PNGs; the source archive does not provide animation for these models.

The bundled index is generated from the community archive [BeubeuReturns/cobblemon_sprites](https://github.com/BeubeuReturns/cobblemon_sprites). This snapshot contains 2,176 PNG files grouped into 1,089 species/form entries and is pinned to upstream commit c7c327ee3c2b8825284353d3bbe32dd505ed3033 (2026-10-17). It is a community-maintained archive, not an official Cobblemon asset feed.

To refresh the index after the upstream repository changes, run:

```sh
node scripts/sync-cobblemon-sprites.mjs
```

Commit the generated `cobblemon-sprites.json` and redeploy. The script follows the upstream default branch and pins image URLs to the selected upstream commit.

**Wallpaper shaders** are visual effects in the editor's **Set the scene** panel. Soft glow, dream haze, chromatic shift, retro scanlines and aurora light are applied to the wallpaper background itself, with adjustable intensity. They are included in PNG and GIF exports. They are not Minecraft shader packs.

Pokémon names, models, artwork and sprites remain the property of their respective rights holders. This fan project is not affiliated with or endorsed by Nintendo, Game Freak, The Pokémon Company or the Cobblemon team.
