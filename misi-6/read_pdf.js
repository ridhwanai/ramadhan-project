const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('d:\\coding puasa\\Misi 6 - FE - REGULER.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
});
