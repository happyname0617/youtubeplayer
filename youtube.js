const express = require('express')
var app = express()
var request = require('request');
var fs = require('fs')
var _ = require('underscore');
var bodyParser = require('body-parser');

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.set('view engine', 'pug');
app.set('views', './views');

app.post('/save', function(req, res){
  var videoID = req.body.videoid;
  var userid = req.body.userid;
  var videoRecord = req.body.videoRecord;

  //console.log("post"+videoID+userid+times);
  
  if(!fs.existsSync(`public/${videoID}`))
  {
    
    fs.mkdirSync(`public/${videoID}`);
  }              
  var fullfilePath =`public/${videoID}/${userid}.json`;
  fs.writeFile(fullfilePath,videoRecord,function(err) {
    if (err) throw err;
    console.log('The file has been saved at '+fullfilePath);
  });

  
});


app.get('/get/lang',function(req,res){
    var id=req.query.url.split("v=")[1];
    var url = 'https://video.google.com/timedtext?hl=en&v=' + id + '&type=list';
    console.log('caption lang url:'+url);
    var nodes =[];
    request(url, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        console.log("Status code: " + response.statusCode);
        if (response.statusCode !== 200) {
            //error
            console.log(error + response.statusCode);
        } else {
            var parse = require('xml-parser');
            var xml = body.toString();
            console.log('caption lang xml:'+xml);
            //console.log(xml)
            var langlist = parse(xml);
            var code='en';
            if(langlist.root.children.length ==0){
                res.render('noCaption')
                return;
            }
            if(langlist.root.children.length ==1)
            {
              console.log('there is only one lang')
                code = langlist.root.children[0].attributes.lang_code
                res.redirect(`/get/${id}/?lang=${code}`)
            }
            else
            {
              for(var i=0; i<langlist.root.children.length;i++)
              {
                  //<option value="volvo">Volvo</option>
                var name = langlist.root.children[i].attributes.lang_original
                var code = langlist.root.children[i].attributes.lang_code
                nodes.push([code,name]);
              }
              
              res.render('getLang',{id:id,nodes:nodes})
            }

        }
        
    })
        
    //res.send(url)
})

//get caption with given language from youtube.com
app.get('/get/:id',function(req,res)
{
    var id=req.params.id;
    var lang=req.query.lang;//'de'; //default language is english (see below)
    var url = 'http://video.google.com/timedtext?lang='+lang+'&v='+id+'&fmt=vtt';
    console.log('get id lang'+ url);
  //var url = 'http://video.google.com/timedtext?lang=de&v=jgdPdeQZ3T8&fmt=vtt';

  request(url, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        console.log("Status code: " + response.statusCode);
        if (response.statusCode !== 200) {
            //error
            console.log(error + response.statusCode);
        } else {
            var sentences = [];
            var txt = body.toString()
            txt = txt.replace(/(\d\d:\d\d:\d\d\.\d\d\d\s*\-\-\>)/g, '\|$1');
            var items = txt.split('|');
            //console.log(items[1])
            var str ='';
            for(var i =0; i<items.length; i++)
            {
                var temp = items[i].match(/(\d\d:\d\d:\d\d\.\d\d\d)\s*\-\-\>\s*(\d\d:\d\d:\d\d\.\d\d\d)(.*)((.*\n?)*)/)
                if(temp) {
                    str+=`<li>${temp['1']} ${temp['2']} ${temp['4']}</li>`
                    var startSec = convert2Sec(temp['1']);
                    var endSec = convert2Sec(temp['2']);
                    sentences.push([startSec,endSec,temp['4'].replace(/\n/g,' '),'']) //starttime, endtime, caption, userCaption
                }
            }
            if(!fs.existsSync(`public/${id}/${id}.json`))
            {
              var videoRecord =
              {
                caption:sentences,
                createdby_userid:'anonymous',
                currentIndex:0,
                forkedFromVideoID:`${id}`
              }
              fs.mkdirSync(`public/${id}`);
              fs.writeFile(`public/${id}/${id}.json`,JSON.stringify(videoRecord),function(err) {
                if (err) throw err;
                console.log('The file has been saved!');});
            }              
              
            res.redirect(`/play/${id}/${id}`)
            
        }
  })
})



app.get('/',function(req,res){
  res.render('home');
})

app.get('/play/:id/:name',function(req,res){

  fs.readFile(`public/${req.params.id}/${req.params.name}.json`,'utf8', (err, videoRecord) => {
    if (err) throw err;


    videoRecord = JSON.parse(videoRecord)


    res.render('play.pug',{mytime:JSON.stringify(videoRecord),id:req.params.id})
  })

  
})

function convert2Sec(str)
{
    console.log(str)
    console.log(typeof str)
    var temp = str.split(':');
    var hours = parseInt(temp[0]);
    var min = parseInt(temp[1]);
    var sec = parseFloat(temp[2]);
    
    return hours*3600+min*60+sec;
}


app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0",function(){
  console.log('listening on %s',process.env.PORT||3000)
})
