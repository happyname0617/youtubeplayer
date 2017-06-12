const express = require('express')
var app = express()
var request = require('request');
var fs = require('fs')
app.use(express.static('public'))
var _ = require('underscore');
app.set('view engine', 'pug');
app.set('views', './views');

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
                    sentences.push([temp['1'],temp['2'],temp['4'].replace(/\n/g,' ')])
                }
            }
            //console.log(body)
            fs.writeFile(`public/${id}.json`,JSON.stringify(sentences),function(err) {
              if (err) throw err;
              console.log('The file has been saved!');});
              
              
            res.redirect(`/play/${id}`)
            
        }
  })
})



app.get('/',function(req,res){
  res.render('home');
})

app.get('/play/:id',function(req,res){

  fs.readFile(`public/${req.params.id}.json`,'utf8', (err, lines) => {
    if (err) throw err;

    lines = JSON.parse(lines)
    var totalCount = lines.length;
    var mytime=[];

    for(var i=0; i<lines.length;i++)
    {
        var startSec = convert2Sec(lines[i][0]);
        var endSec = convert2Sec(lines[i][1]);
        mytime.push([startSec,endSec,lines[i][2]])
    
    }
    res.render('play.pug',{totalCount:totalCount, mytime:JSON.stringify(mytime),id:req.params.id})
  })

  
})

function convert2Sec(str)
{
    //console.log(str)
    //console.log(typeof str)
    var temp = str.split(':');
    var hours = parseInt(temp[0]);
    var min = parseInt(temp[1]);
    var sec = parseFloat(temp[2]);
    
    return hours*3600+min*60+sec;
}


app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0",function(){
  console.log('listening on %s',process.env.PORT||3000)
})
