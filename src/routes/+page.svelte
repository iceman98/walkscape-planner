<script lang="ts">
  import { browser } from "$app/environment";
  import { Stage, Layer, Group, Text, Rect } from "svelte-konva";

  import character from "../data/character.json";
  import recipes from "../data/recipes.json";
</script>

{#if browser}
  <Stage width={window.innerWidth} height={window.innerHeight}>
    <Layer>
      {#each recipes as recipe, index}
        <Group x={10} y={20 * index}>
          <Rect x={0} y={0} width={100} height={20} fill="grey" />
          <Text text={recipe.name} x={0} y={0} color="white" />
        </Group>
      {/each}
    </Layer>
  </Stage>
{/if}
