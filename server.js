// PACKAGES
const express=require('express')
const sqlite3=require('sqlite3')
// CONSTANTS AND VARIABLES
const port=8080
const app=express()
// MIDDLEWARES
app.use(express.static('public'))


//COPY AND PASTE FROM CANVAS DATBASE STUFF

// ROUTES
// Define default route '/' and __dirname sets the path to the folder.
app.get('/', function(req, res) {
    res.sendFile(__dirname+'/views/cv.html')
})

// different ways of doing functions
app.listen(port, function() {
    console.log(`server up and running on http://localhost:${port}...`)
})