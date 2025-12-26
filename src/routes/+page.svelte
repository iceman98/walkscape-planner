<script lang="ts">
  import { browser } from "$app/environment";
  import { Stage, Layer, Group, Text, Rect, Image } from "svelte-konva";

  import character from "../data/character.json";
  import recipes from "../data/recipes.json";
  import icons from "../lib/assets/icons.json";

  let stageRef: any;
  let scale = 1;
  let stagePos = { x: 0, y: 0 };
  let stageContainer: HTMLDivElement;
  let stageOffset = { x: 0, y: 0 }; // Track stage position for zoom centering
  let isDragging = false;
  let dragStartPos = { x: 0, y: 0 };
  let dragStartStagePos = { x: 0, y: 0 };

  // Cache for loaded images
  const loadedImages: Record<string, HTMLImageElement> = {};

  // Type definitions
  type IconsType = {
    materials: Record<string, string>;
    professions: Record<string, string>;
  };

  // Cast icons to proper type
  const typedIcons: IconsType = icons as IconsType;

  // Simple function to load an image
  async function loadImage(url: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Load all icons on component mount
  import { onMount } from 'svelte';
  
  onMount(() => {
    // Load all material icons
    const loadMaterialIcons = async () => {
      for (const [name, path] of Object.entries(typedIcons.materials)) {
        const url = `/src/lib/assets/${path.substring(2)}`;
        const img = await loadImage(url);
        if (img) loadedImages[path] = img;
      }
    };
    
    // Load all profession icons
    const loadProfessionIcons = async () => {
      for (const [name, path] of Object.entries(typedIcons.professions)) {
        const url = `/src/lib/assets/${path.substring(2)}`;
        const img = await loadImage(url);
        if (img) loadedImages[path] = img;
      }
    };

    // Add global mouse event listeners
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      
      stageOffset.x = dragStartStagePos.x + dx;
      stageOffset.y = dragStartStagePos.y + dy;
    };

    const handleGlobalMouseUp = () => {
      isDragging = false;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    // Load icons
    loadMaterialIcons();
    loadProfessionIcons();

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  });

  // Group recipes by profession and sort by level then alphabetically
  $: groupedRecipes = recipes.reduce((acc: Record<string, any[]>, recipe) => {
    const profession = recipe.requirements.profession.name;
    if (!acc[profession]) {
      acc[profession] = [];
    }
    acc[profession].push(recipe);
    return acc;
  }, {});

  // Sort each profession's recipes by level then name
  $: sortedGroupedRecipes = Object.keys(groupedRecipes).reduce((acc: Record<string, any[]>, profession) => {
    acc[profession] = groupedRecipes[profession].sort((a, b) => {
      const levelDiff = a.requirements.profession.level - b.requirements.profession.level;
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    });
    return acc;
  }, {});

  // Calculate Y positions for each profession to avoid overlap
  $: professionPositions = Object.keys(sortedGroupedRecipes).reduce((acc: Record<string, number>, profession, index) => {
    let yOffset = 0;
    for (let i = 0; i < index; i++) {
      const prevProfession = Object.keys(sortedGroupedRecipes)[i];
      yOffset += 60 + (sortedGroupedRecipes[prevProfession].length * 80) + 20; // header height + recipes height + spacing
    }
    acc[profession] = yOffset;
    return acc;
  }, {});

  function handleWheel(e: { evt: WheelEvent }) {
    if (!stageRef) return;
    
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = stageRef.scaleX();
    const pointer = stageRef.getPointerPosition();
    
    if (!pointer) return;
    
    // Calculate the new scale
    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;

    // Calculate the new position to keep the pointer in the same place
    const mousePointTo = {
      x: (pointer.x - stageRef.x()) / oldScale,
      y: (pointer.y - stageRef.y()) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    // Apply the new scale and position
    stageRef.scaleX(newScale);
    stageRef.scaleY(newScale);
    stageRef.x(newPos.x);
    stageRef.y(newPos.y);
    stageRef.batchDraw();
    
    // Update the scale variable for Svelte reactivity
    scale = newScale;
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    dragStartPos = { x: e.clientX, y: e.clientY };
    dragStartStagePos = { x: stageOffset.x, y: stageOffset.y };
  }

  function handleMouseMove(e: { evt: MouseEvent }) {
    if (!isDragging) return;
    
    const dx = e.evt.clientX - dragStartPos.x;
    const dy = e.evt.clientY - dragStartPos.y;
    
    stageOffset.x = dragStartStagePos.x + dx;
    stageOffset.y = dragStartStagePos.y + dy;
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function handleNativeWheel(e: WheelEvent) {
    if (!stageRef) return;
    
    e.preventDefault();
    
    const scaleBy = 1.1;
    const oldScale = scale;
    
    // Get mouse position relative to the container
    const rect = stageContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newScale = e.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    
    // Limit scale
    if (newScale < 0.5 || newScale > 5) return;
    
    // Calculate the offset to keep the mouse position fixed
    const scaleChange = newScale - oldScale;
    const offsetX = -(mouseX - stageOffset.x) * scaleChange / oldScale;
    const offsetY = -(mouseY - stageOffset.y) * scaleChange / oldScale;
    
    // Update scale and offset
    scale = newScale;
    stageOffset.x += offsetX;
    stageOffset.y += offsetY;
  }
</script>

{#if browser}
  <div bind:this={stageContainer} on:wheel={handleNativeWheel} on:mousedown={handleMouseDown}>
    <Stage 
      bind:this={stageRef}
      width={window.innerWidth} 
      height={window.innerHeight}
      scaleX={scale}
      scaleY={scale}
      x={stageOffset.x}
      y={stageOffset.y}
    >
    <Layer>
      {#each Object.entries(sortedGroupedRecipes) as [profession, professionRecipes]}
        <Group x={10} y={professionPositions[profession]}>
          <!-- Profession header -->
          <Rect x={0} y={0} width={300} height={50} fill="darkblue" />
          <Text text={profession} x={10} y={15} color="white" fontSize={18} />
          
          <!-- Profession icon -->
          {#if typedIcons.professions[profession]}
            {@const professionIcon = loadedImages[typedIcons.professions[profession]]}
            {#if professionIcon}
              <Image
                image={professionIcon}
                x={250}
                y={10}
                width={30}
                height={30}
              />
            {/if}
          {/if}
          
          <!-- Recipes for this profession -->
          {#each professionRecipes as recipe, recipeIndex}
            {@const recipeY = 60 + recipeIndex * 80}
            <Group x={0} y={recipeY}>
              <!-- Recipe card background -->
              <Rect x={0} y={0} width={400} height={70} fill="lightgrey" stroke="black" strokeWidth={1} />
              
              <!-- Recipe output icon -->
              {#if typedIcons.materials[recipe.output]}
                {@const outputIcon = loadedImages[typedIcons.materials[recipe.output]]}
                {#if outputIcon}
                  <Image
                    image={outputIcon}
                    x={10}
                    y={15}
                    width={40}
                    height={40}
                  />
                {/if}
              {/if}
              
              <!-- Recipe info -->
              <Group x={60} y={5}>
                <Text text={recipe.name} x={0} y={0} fontSize={12} fontWeight="bold" />
                <Text text={`Output: ${recipe.output}`} x={0} y={15} fontSize={10} />
                
                <!-- Materials -->
                <Group x={0} y={30}>
                  <Text text="Materials:" x={0} y={0} fontSize={10} fontWeight="bold" />
                  {#each recipe.requirements.materials as material, matIndex}
                    {@const matX = matIndex * 80}
                    <Group x={matX} y={10}>
                      {#if typedIcons.materials[material.name]}
                        {@const matIcon = loadedImages[typedIcons.materials[material.name]]}
                        {#if matIcon}
                          <Image
                            image={matIcon}
                            x={0}
                            y={0}
                            width={20}
                            height={20}
                          />
                        {/if}
                      {/if}
                      <Text text={`${material.amount}x`} x={0} y={22} fontSize={8} textAnchor="middle" />
                    </Group>
                  {/each}
                </Group>
              </Group>
              
              <!-- Level indicator -->
              <Rect x={350} y={5} width={40} height={20} fill="orange" />
              <Text text={`Lv${recipe.requirements.profession.level}`} x={370} y={18} fontSize={10} textAnchor="middle" color="white" />
            </Group>
          {/each}
        </Group>
      {/each}
    </Layer>
  </Stage>
  </div>
{/if}
