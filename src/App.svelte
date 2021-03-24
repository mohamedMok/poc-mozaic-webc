<script>
	import Button from './stories/Button.svelte'
	import Device_Desktop from '@mozaic-ds/icons/svg/Device_Desktop_24px.svg';
	export let name;
</script>

<main>
	<h1>Hello {name}!</h1>
	
	<p>Visit the <a href="https://svelte.dev/tutorial">Svelte tutorial</a> to learn how to build Svelte apps.</p>
	<Button size='l' />
	<Device_Desktop />
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>