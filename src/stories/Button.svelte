<script>
  import './button.css';
  import { createEventDispatcher } from 'svelte';
  // import { Device_Desktop_24px } from '@mozaic-ds/icons/svg/';
  import Device_Desktop from '@mozaic-ds/icons/svg/Device_Desktop_24px.svg';

  /**
   * Button size
   */
  export let size = 'm';
  /**
   * Button contents
   */
  export let label = '';
  /** 
   * Button theme
  */
  export let theme = 'solid';

  /** 
   * Button width - Fit or Full
  */
  export let width = '';

  const dispatch = createEventDispatcher();

  /**
   * Optional click handler
   */
  function onClick(event) {
    dispatch('click', event);
  }
</script>


<button
  type="button"
  class={['mc-button', `mc-button--${size}`, `mc-button--${theme}`, `mc-button--${width}`].join(' ')}
  on:click={onClick}>
  <!-- <img src={Device_Desktop} alt="svg" /> -->
  {label}
</button>
