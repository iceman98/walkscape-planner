<script lang="ts">
    import { browser } from "$app/environment";
    import Stage from "svelte-konva/Stage.svelte";
    import Layer from "svelte-konva/Layer.svelte";
    import Rect from "svelte-konva/Rect.svelte";
    import Text from "svelte-konva/Text.svelte";
	import data from '../data/recipes.json';
  import character from '../data/character.json';

</script>

{#if browser}
<Stage width={window.innerWidth} height={window.innerHeight}>
  <Layer>
    {#each data.recipes as recipe}
        <Text text={recipe.name} x={100} y={100} />
    {/each}
  </Layer>
</Stage>
{/if}