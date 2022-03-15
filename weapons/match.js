const fs = require('fs');
const Papa = require('papaparse');

const rawList = fs.readFileSync('./files/Destiny - Weapons.csv', 'utf8');
let list = Papa.parse(rawList, {
  header: true,
});
const currentRaw = fs.readFileSync('./files/current.csv', 'utf8');

let current = Papa.parse(currentRaw, {
  header: true,
});

let newList = {};
list.data.forEach((l) => {
  l.count = 0;
  newList[l.name.toLowerCase()] = l;
});

current.data.forEach((c) => {
  let item = newList[c.name.toLowerCase()];
  if (item) {
    item.count += 1;
    newList[c.name.toLowerCase()] = item;
  }
});

fs.writeFile(`./files/output.csv`, Papa.unparse(Object.values(newList)), (err) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(`file output written successfully`);
});
