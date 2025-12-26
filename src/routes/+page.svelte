<script lang="ts">
  import { browser } from "$app/environment";
  import { Stage, Layer, Group, Text, Rect } from "svelte-konva";

  import character from "../data/character.json";
  import recipes from "../data/recipes.json";

  let stageRef: any;
  let scale = 1;
  let stagePos = { x: 0, y: 0 };
  let stageContainer: HTMLDivElement;

  function handleWheel(e: { evt: WheelEvent }) {
    console.log('Wheel event triggered', e.evt.deltaY);
    if (!stageRef) return;
    
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = stageRef.scaleX();
    const pointer = stageRef.getPointerPosition();
    
    console.log('Old scale:', oldScale, 'Pointer:', pointer);
    
    const mousePointTo = {
      x: (pointer.x - stageRef.x()) / oldScale,
      y: (pointer.y - stageRef.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    console.log('New scale:', newScale);
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    stageRef.scaleX(newScale);
    stageRef.scaleY(newScale);
    stageRef.position(newPos);
    stageRef.batchDraw();
    
    scale = newScale;
    
    console.log('Scale applied, new scale:', stageRef.scaleX());
  }

  function handleDragStart() {
    if (!stageRef) return;
    const pos = stageRef.position();
    stagePos = { x: pos.x, y: pos.y };
  }

  function handleDragMove() {
    if (!stageRef) return;
    const pos = stageRef.position();
    stageRef.position(pos);
    stageRef.batchDraw();
  }

  function handleNativeWheel(e: WheelEvent) {
    console.log('Native wheel event', e.deltaY);
    if (!stageRef) return;
    
    e.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = scale; // Use our scale variable
    const stage = stageRef; // Try direct access
    
    console.log('Stage ref:', stageRef);
    console.log('Old scale:', oldScale);
    
    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    console.log('New scale:', newScale);
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;
    
    // Update scale variable and let Svelte handle the rest
    scale = newScale;
    
    console.log('Scale updated to:', scale);
  }

  function handleDragEnd() {
    if (!stageRef) return;
    const pos = stageRef.position();
    stagePos = { x: pos.x, y: pos.y };
  }
</script>

{#if browser}
  <div bind:this={stageContainer} on:wheel={handleNativeWheel}>
    <Stage 
      bind:this={stageRef}
      width={window.innerWidth} 
      height={window.innerHeight}
      scaleX={scale}
      scaleY={scale}
      draggable={true}
      on:dragstart={handleDragStart}
      on:dragmove={handleDragMove}
      on:dragend={handleDragEnd}
    >
    <Layer>
      {#each recipes as recipe, index}
        <Group x={10} y={20 * index}>
          <Rect x={0} y={0} width={100} height={20} fill="grey" />
          <Text text={recipe.name} x={0} y={0} color="white" />
        </Group>
      {/each}
    </Layer>
  </Stage>
  </div>
{/if}
