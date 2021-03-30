<svelte:options tag="mc-button" />

<script>
  // import './button.css';
  import { createEventDispatcher } from 'svelte';
  // import { Device_Desktop_24px } from '@mozaic-ds/icons/svg/';
  import Icon from './Icon.svelte';
  import Icons from './assets/icons.json';
  // import Colors from './assets/colors.svg';

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

  export let icon;
  export let iconPosition;

  const dispatch = createEventDispatcher();

  /**
   * Optional click handler
   */
  // function onClick(event) {
  //   dispatch('click', event);
  // }
</script>

<style lang="scss">
  @import "settings-tools/_all-settings";
  @import "components/c.button";
</style>

<button
  type="button"
  class={['mc-button', `mc-button--${size}`, `mc-button--${theme}`, `mc-button--${width}`].join(' ')}>
  {#if icon }
    {#if iconPosition == 'left' }
      <Icon class="mc-button__icon" width={"32px"} height={"32px"} viewBox={"32px"} data={Icons.screen}/>
    {/if}
  {/if}

  {#if label }
      {label}
  {/if}
  {#if icon }
    {#if iconPosition == 'right' }
      <Icon class="mc-button__icon" width={"32px"} height={"32px"} viewBox={"32px"} data={Icons.screen}/>
    {/if}
  {/if}
</button>


