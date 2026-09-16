<script lang="ts">
	import LinkView from '$lib/components/link-view.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<LinkView {data} shared />
