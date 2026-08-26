async function probe() {
  try {
    const luma = await fetch('https://api.lu.ma/public/v1/events');
    console.log('Luma:', luma.status);
  } catch (e) {
    console.log('Luma:', e.message);
  }

  try {
    const internshala = await fetch('https://internshala.com/');
    console.log('Internshala:', internshala.status);
  } catch (e) {
    console.log('Internshala:', e.message);
  }
}
probe();
