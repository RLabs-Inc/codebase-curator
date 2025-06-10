<script>
  import { onMount, onDestroy } from 'svelte'
  import { writable } from 'svelte/store'
  
  // Svelte 5 runes
  let count = $state(0)
  let doubled = $derived(count * 2)
  
  // Props with rune
  let { name = 'World' } = $props()
  
  // Store subscription
  const userStore = writable({ name: 'John' })
  $: userName = $userStore.name
  
  // Reactive statement
  $: console.log(`Count is ${count}`)
  
  // Lifecycle hooks
  onMount(() => {
    console.log('Component mounted')
    return () => {
      console.log('Cleanup on unmount')
    }
  })
  
  onDestroy(() => {
    console.log('Component destroyed')
  })
  
  // Event handler
  function handleClick() {
    count += 1
  }
</script>

<h1>Hello {name}!</h1>
<button on:click={handleClick}>
  Count: {count}
</button>
<p>Doubled: {doubled}</p>

{#if count > 5}
  <p>Count is high!</p>
{:else if count > 0}
  <p>Keep clicking!</p>
{:else}
  <p>Click the button</p>
{/if}

{#each [1, 2, 3] as num}
  <span>{num}</span>
{/each}

<style>
  h1 {
    color: #ff3e00;
  }
  
  .highlight {
    background-color: yellow;
  }
  
  :global(body) {
    margin: 0;
  }
</style>