const express = require('express')
var app = express()
var request = require('request');
var fs = require('fs')
app.use(express.static('public'))

app.get('/get',function(req,res)
{
  var url = 'http://video.google.com/timedtext?lang=de&v=jgdPdeQZ3T8&fmt=vtt';

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
                // console.log(i)
                // for(var prop in temp)
                // {
                //     console.log(prop)
                //     console.log(temp[prop])
                // }
            }
            //console.log(body)
            fs.writeFile('public/test.json',JSON.stringify(sentences),function(err) {
              if (err) throw err;
              console.log('The file has been saved!');});
              
            res.redirect('/')
            
        }
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
app.get('/',function(req,res){
   fs.readFile('public/test.json','utf8', (err, lines) => {
  if (err) throw err;
    lines = JSON.parse(lines)
    var totalCount = lines.length;
    console.log(lines);
    var mytime=[];
    for(var i=0; i<lines.length;i++)
    {
        var startSec = convert2Sec(lines[i][0]);
        var endSec = convert2Sec(lines[i][1]);
        mytime.push([startSec,endSec,lines[i][2]])
        console.log(mytime[i]);

    }
    res.send(`<!DOCTYPE html>
<html>
<script
  src="https://code.jquery.com/jquery-3.2.1.min.js"
  integrity="sha256-hwg4gsxgFZhOsEEamdOYGBf13FyQuiTwlAQgxVSNgt4="
  crossorigin="anonymous"></script>
  <body>
    <!-- 1. The <iframe> (and video player) will replace this <div> tag. -->
    <div id="player"></div>
    <div class='debug'></div>
    <div> 
        <p id='underline_str'></p>
        <p id='solution_str'></p>
        <textarea id='inputstr' rows="4" cols="50"></textarea>
    <button id='answer'>Check Answer</button>
    </div>
    <div><p><button class='prev'>prev sentence</button><button class='next'>next sentence</button></p>
      <p><button class='stop'>stop</button><button class='play'>play</button></p></div>
    <script>
      // 2. This code loads the IFrame Player API code asynchronously.
      var tag = document.createElement('script');

      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      // 3. This function creates an <iframe> (and YouTube player)
      //    after the API code downloads.
      var player;
      var margin = 0.2;
      //var times = [['2.216','3.576'],['03.576','05.616'],['05.616','8.096'],['8.336','10.336'],['10.616','12.616'],['13.576','15.496']];
      var times = ${JSON.stringify(mytime)};
      var totalCount = ${totalCount};
  
      var currIdx = 0;
      function onYouTubeIframeAPIReady() {
        player = new YT.Player('player', {
          height: '390',
          width: '640',
          cc_load_policy:3,
          videoId: 'jgdPdeQZ3T8',
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        });
      }

      // 4. The API will call this function when the video player is ready.
      function onPlayerReady(event) {
        event.target.playVideo();
        player.seekTo(getStartTime(currIdx,margin))
         $('#underline_str').text(myconvert(times[currIdx][2],$('#inputstr').val()))
      }

      // 5. The API calls this function when the player's state changes.
      //    The function indicates that when playing a video (state=1),
      //    the player should play for six seconds and then stop.
      var done = false;
      var timer;
       var timersleep ;
      function onPlayerStateChange(event) {
        if (event.data == YT.PlayerState.PLAYING && !done) {
          setTimeout(repeatVideo, getDuration(currIdx,margin))
          done = true;
        }
      }
      
      function repeatAfterSec()
      {
        player.pauseVideo();
        clearTimeout(timer);
        timersleep = setTimeout(repeatVideo,1000);
      }
      function repeatVideo() {
       
        player.seekTo(getStartTime(currIdx,margin));
        player.playVideo();
        timer = setTimeout(repeatAfterSec,getDuration(currIdx,margin));
        clearTimeout(timersleep);
        $('.debug').text(currIdx+'/'+totalCount)
      }
      
      function getStartTime(index,margin)
      {
        var start = parseFloat(times[index][0])-margin
        return start>=0?start:0
      }
        
      function getEndTime(index,margin)
      {
        return parseFloat(times[index][1])+margin;
      }
       function getDuration(index,margin)
        {
          var duration = (getEndTime(index,margin)-getStartTime(index,margin))*1000;
          console.log(duration)
           return duration;
        }

function myconvert(solution, input)
    {
    console.log('solution:',solution)
        console.log('input:',input)
      var marker = '+';
      console.log(typeof solution);
      var temp = solution.replace(/[a-zA-Z]/gi,marker);
      console.log('temp:',temp)
      var temp2 = input.replace(/[^a-zA-Z]/gi,'')
      console.log('temp2:',temp2)
      for(var i=0; i<temp2.length; i++)
        {
          temp = temp.replace(marker,temp2[i])
        }
        console.log('result:',temp)
      return temp;
    }
 
$(document).ready(function(){
      $('#inputstr').keyup(function(){
        $('#underline_str').text(myconvert(times[currIdx][2],$('#inputstr').val()))
      })
  
      $('#answer').click(function(){
        $('#solution_str').text(times[currIdx][2])
      })
  
  $('.next').click(function(){
    currIdx=currIdx+1;
            //$('.debug').text(currIdx+'/'+totalCount)
    clearTimeout(timer);
    clearTimeout(timersleep);
    repeatVideo();
    $('#solution_str').text('');
     $('#underline_str').text(myconvert(times[currIdx][2],$('#inputstr').val()))
      })
    $('.prev').click(function(){
    currIdx=currIdx-1;
      currIdx=currIdx>0?currIdx:0
            //$('.debug').text(currIdx+'/'+totalCount)
      clearTimeout(timer);
      clearTimeout(timersleep);
repeatVideo();
$('#solution_str').text('')
 $('#underline_str').text(myconvert(times[currIdx][2],$('#inputstr').val()))
      })
  $('.play').click(function(){
    
            $('.debug').text('play')
player.playVideo();
      })
  $('.stop').click(function(){
    $('#solution_str').text('')
            $('.debug').text('stop')
    clearTimeout(timer);
    clearTimeout(timersleep);
player.stopVideo();
      })
})
    </script>
  </body>
</html>`);
})
})
app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0",function(){
  console.log('listening on %s',process.env.PORT||3000)
})
