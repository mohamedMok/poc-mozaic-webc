<script>
    export let width;
    export let height;
    export let data;
    export let viewBox;
  </script>
  
<svg xmlns="http://www.w3.org/2000/svg" {width} {height} viewBox="0 0 {viewBox} {viewBox}">
    <path d={data} />
</svg>