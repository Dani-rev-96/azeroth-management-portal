<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtPage />
  </NuxtLayout>
</template>
<style lang="scss">
@use '@/styles/main.scss';

body,html {
	margin: 0;
	padding: 0;
}
</style>
