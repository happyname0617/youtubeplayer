var env = process.env.NODE_ENV || 'development';
var config = require('./config')[env];

const express = require('express')
var session = require('express-session');
//var FileStore = require('session-file-store')(session);
const MongoStore = require('connect-mongo')(session);

var app = express()
var request = require('request');
var fs = require('fs')
var _ = require('underscore');
var bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var assert = require('assert');


var passport = require('passport')
var FacebookStrategy = require('passport-facebook').Strategy;

app.use(express.static('client'))
app.use(bodyParser.urlencoded({ extended: false }))
app.set('view engine', 'pug');
app.set('views', './views');

app.use(session({
  secret: config.SESSION_SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  store:new MongoStore({ url: config.DB_URL })
}));

var mongodb;
var collectionUser;
var collectionVideo;
var bundleVideoList =config.BUNDLE_VIDEO_LIST;
//["595a55225162b73b3ca72b91","5948eb94076d52107e95e38b","5948f20a076d52107e95e38d","5958baac7ed9c93c76967137","5958bf087ed9c93c76967138","5958bfab7ed9c93c76967139"];
//bundle video list
//var bundleVideoList =['5958bf087ed9c93c76967138','5948eb94076d52107e95e38b',,'5958bf087ed9c93c76967138','5958baac7ed9c93c76967137',];
function dbconnect(url)
{
  MongoClient.connect(url, function(err, db) {
     if (err) {console.log(err); return err; }
    console.log("Connected correctly to server");
    mongodb=db;
    collectionUser = mongodb.collection('User');
    collectionVideo = mongodb.collection('Video');
  });
}

function dbdisconnect(){
  mongodb.close();
}

dbconnect(config.DB_URL);

app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new FacebookStrategy({
    clientID: config.FACEBOOK_APP_ID,
    clientSecret: config.FACEBOOK_APP_SECRET,
    callbackURL: config.FACEBOOK_CALLBACK_URL,
    profileFields:['id', 'email', 'gender', 'link', 'locale', 'name', 'timezone', 'verified', 'displayName','age_range']
  },
  function(accessToken, refreshToken, profile, done) {
    //console.log(profile);
    var _id = 'facebook:'+profile.id;;
      collectionUser.findOne({_id:_id},function(err, foundUser) {
        if (err) {console.log(err); return done(err); }
        if(foundUser){
          console.log("user already exist, proceed to login")
          done(null, foundUser);
        }
        else
        {
          console.log("new user, proceed to login")
          var newuser = profile._json;
          newuser._id = _id;

          collectionUser.insertOne(newuser,function(err, newuser) {
            if (err) {console.log(err); return done(err); }
            forkInit(_id);
	  });
          done(null,newuser);
        }
      });
  }

));


passport.serializeUser(function(user, done) {
  console.log('serializeUser', user);
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  console.log('deserializeUser', id);
 collectionUser.findOne({_id:id},function(err, foundUser) {
       console.log("result: "+JSON.stringify(foundUser))
        done(err, foundUser);
  });

});

//add bundle videos
function forkInit(id){
 bundleVideoList.forEach(function(item){
   forkVideo(item,id)
 })
}
app.get('/admin/fork/:video_id/:userid',function(req,res){
  
  if(req.user) //logged in 
  {
    var videoID = req.params.video_id
    var userID = req.params.userid
    forkVideo(videoID,userID);
    
  }
  res.redirect('/');
})
app.get('/fork/:video_id',function(req, res) {
  if(req.user) //logged in 
  {
    var video_id = ObjectId(req.params.video_id);
    console.log('/exam/'+video_id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { console.log(err); return err; }
      if(foundVideo){
       console.log("same video exist");
      //console.log(typeof foundVideo.caption)
      }
      else
      {
        //not exist then add
        forkVideo(req.params.video_id,req.user._id);
      }
    });

  }
  else{
    res.redirect('/')
  } 
})
//http://www.typingtube.com/fork/595a55225162b73b3ca72b91
app.get('/fork',function(req,res){
  forkInit(req.user._id);
  //add bundle videos
 // bundleVideoList.forEach(function(item){
 //   forkVideo(item,req.user._id)
 // })
  
  res.redirect('/');

})

app.get('/auth/logout', function(req, res){
  req.logout();
  req.session.save(function(){
    res.redirect('/');
  });
});

app.get('/about',function(req,res){
    res.render('about.pug')
})

app.get('/feed',function(req,res){
  if(req.user) //logged in 
  {

    collectionVideo.find({owner:req.user._id},function(err, cursor) {
      if(err){return err;}
      cursor.toArray(function(err,foundVideoList){
        if(err){return err;}
        //console.log(foundVideoList)
        res.render('feed.pug',{videolist:foundVideoList})
      });
    })
  }
  else //logged out user
  {
    res.render('home');
  }
})

app.get('/forum',function(req,res){
  if(req.user) //logged in 
  {
    res.render('forum.pug')
  }
  else{
    res.redirect('/')
  }
})
app.get('/dbtest',function(req, res) {
    // Connection URL

    // Use connect method to connect to the server
    MongoClient.connect(config.DB_URL, function(err, db) {
      assert.equal(null, err);
      console.log("Connected correctly to server");
     //db.collection('documents').drop();
    //  insertDocuments(db, function() {
        findDocuments(db, function() {
          db.close();
        });
    //  });
    });

    res.send('test done')
})

var insertDocuments = function(db, callback) {
  // Get the documents collection
  var collection = db.collection('documents');
  // Insert some documents
  collection.insertMany([
    {a : 1}, {a : 2}, {a : 3}
  ], function(err, result) {
    assert.equal(err, null);
    assert.equal(3, result.result.n);
    assert.equal(3, result.ops.length);
    console.log("Inserted 3 documents into the collection");
    callback(result);
  });
}

var findDocuments = function(db, callback) {
  // Get the documents collection
  var collection = db.collection('documents');
  // Find some documents
  collection.find({}).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found the following records");
    console.log(docs)
    callback(docs);
  });
}





app.get('/login',function(req, res) {
    res.render('login.pug')
})
app.get('/auth/logout', function(req, res){
  req.logout();
  req.session.save(function(){
    res.redirect('/');
  });
});


// Redirect the user to Facebook for authentication.  When complete,
// Facebook will redirect the user back to the application at
//     /auth/facebook/callback
app.get('/auth/facebook', passport.authenticate('facebook',{scope:'email'}));

// Facebook will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { successRedirect: '/',
                                      failureRedirect: '/' }));




app.post('/update', function(req, res){
  //TODO user login status check
  //console.log(req.body.videoRecord)
  var videoRecord = JSON.parse(req.body.videoRecord);

  var video_id = ObjectId(videoRecord._id);
  collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
    if (err) {console.log(err); return err; }
    if(foundVideo){
      console.log("video found, updated it successfully")
      collectionVideo.updateOne({_id:video_id},{ $set: { caption : videoRecord.caption, currentIndex:videoRecord.currentIndex } })
    }
    else
    {
        console.log('video is not existing! something wrong')
    }
  });

});
app.get('/exam/:video_id',function(req, res) {
  if(req.user) //logged in 
  {
    var video_id = ObjectId(req.params.video_id);
    console.log('/exam/'+video_id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { console.log(err); return err; }
      if(foundVideo){
       console.log("video found");
      //console.log(typeof foundVideo.caption)

        res.render('exam.pug',{mytime:JSON.stringify(foundVideo)})
      }
    });

  }
  else{
    res.redirect('/')
  } 
})


app.get('/get/lang/:youtubeVideoId',function(req,res){
    console.log("get/lang "+req.params.youtubeVideoId);
    var YoutubeVideoId=req.params.youtubeVideoId;
    var url = 'https://video.google.com/timedtext?hl=en&v=' + YoutubeVideoId + '&type=list';
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
            //console.log('caption lang xml:'+xml);
            //console.log(xml)
            var langlist = parse(xml);
            var code='en';
            if(langlist.root.children.length ==0){
                res.render('noCaption')
                return;
            }
            // if(langlist.root.children.length ==1)
            // {
            //   console.log('there is only one lang')
            //     code = langlist.root.children[0].attributes.lang_code
            //     res.redirect(`/get/${YoutubeVideoId}/?lang=${code}`)
            // }
            else
            {
              for(var i=0; i<langlist.root.children.length;i++)
              {
                  //<option value="volvo">Volvo</option>
                var name = langlist.root.children[i].attributes.lang_original
                var code = langlist.root.children[i].attributes.lang_code
                nodes.push([code,name]);
              }
              
              res.json(nodes);
              //res.render('getLang',{id:id,nodes:nodes})
            }

        }
        
    })
        
    //res.send(url)
})
app.get('/delete/:youtubeVideoId',function(req,res){
    var YoutubeVideoId=ObjectId(req.params.youtubeVideoId);
    console.log("/delete/ "+req.params.youtubeVideoId);

    collectionVideo.findOne({_id:YoutubeVideoId},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        console.log("video found");
        //console.log(typeof foundVideo.caption)
        if(foundVideo.owner==req.user._id)
        {
          collectionVideo.remove({_id:YoutubeVideoId},function(err,result){
            if (err) {console.log(err); return err; }
            //console.log(result);
            res.redirect('/')
          })   
        }
        else
        {
          res.send('the video is not owned by you')
        }
      }
      else
      {
        res.send('there is no such a video')
        
      }
    });
})

app.get('/get/videoInfo/:youtubeVideoId',function(req,res){
    var YoutubeVideoId=req.params.youtubeVideoId;
    console.log("/get/videoInfo/ "+req.params.youtubeVideoId);
    getVideoInfo(YoutubeVideoId,function(vinfo) {
      res.json(vinfo);        
    })

})
function getVideoInfo(YouTubeVideoID,callback){

  var url = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&id='+YouTubeVideoID+'&fields=items(id,snippet)&key='+config.GOOGLE_API_KEY;
  request(url, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        console.log("Status code: " + response.statusCode);
        if (response.statusCode !== 200) {
            //error
            console.log(error + response.statusCode);
        } else {
          var result = JSON.parse(body);
          //console.log(JSON.stringify(result))
          callback(result);
        }
  })
}

function getVideoCaption(YouTubeVideoID,languageID,callback){
  var url = 'http://video.google.com/timedtext?lang='+languageID+'&v='+YouTubeVideoID+'&fmt=vtt';
  console.log('get video caption url: '+ url);
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
            //console.log(sentences)
            callback(sentences);
        }
  })
  
}



function clearCaptionUserAnswer(caption)
{
  //caption[0] start time
  //caption[1] end time
  //caption[2] original script anwer
  //caption[3] user input answer
  for(var i=0; i<caption.length;i++)
   {
     caption[i][3]='';
   }
  return caption;
}

function forkVideo(videoRecordId,userID)//fork given video to the given user
{
    var video_id = ObjectId(videoRecordId);

    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        console.log("fork: video found")
        var newVideo = foundVideo;
        delete newVideo._id
        newVideo.owner=userID;
        newVideo.caption=clearCaptionUserAnswer(foundVideo.caption);
        newVideo.currentIndex=0;
        newVideo.forkedFromVideoID=videoRecordId;

        collectionVideo.insertOne(newVideo,function(err, insertedDocument) {
          if (err) {console.log(err); return err; }
          console.log('fork: video forked successfully:'+insertedDocument.insertedId);
        })

      }
      else
      {
          console.log('video is not existing! something wrong'+videoRecordId)
      }
    });
 
}
app.post('/newvideo',function(req, res) {

  var YouTubeVideoID=req.body.youtubeVideoId;
  var langCode=req.body.lang;
  console.log('/newvideo '+YouTubeVideoID+' '+langCode)
  getVideoInfo(YouTubeVideoID,function(vinfo) {
      //var langCode = vinfo.items[0].snippet.defaultAudioLanguage;
      getVideoCaption(YouTubeVideoID,langCode, function(sentences){
        //console.log(JSON.stringify(sentences))
        //console.log('typeof:'+typeof sentences);
        var videoRecord =
        {
          owner:`${req.user._id}`,
          caption:sentences,
          currentIndex:0,
          YouTubeVideoID:`${YouTubeVideoID}`,
          forkedFromVideoID:`${YouTubeVideoID}`,
          videoTitle:vinfo.items[0].snippet.title,
          videoDescription:vinfo.items[0].snippet.description,
          defaultAudioLanguage:vinfo.items[0].snippet.defaultAudioLanguage,
          videoCaptionLangCode:langCode,
          thumbnails:vinfo.items[0].snippet.thumbnails
        }
        collectionVideo.insertOne(videoRecord,function(err, insertedDocument) {
          if (err) {console.log(err); return err; }
          console.log('video inserted successfully:'+insertedDocument.insertedId);
          res.redirect(`/play/${insertedDocument.insertedId}`);
        })
  
      })
      
  })
    
})

// //get caption with given language from youtube.com //create new from youtube.com
// app.get('/get/:id',function(req,res)
// {
//   console.log('/get/id')
//     var id=req.params.id;
//     var lang=req.query.lang;//'de'; //default language is english (see below)
//     var url = 'http://video.google.com/timedtext?lang='+lang+'&v='+id+'&fmt=vtt';
//     console.log('get id lang '+ url);
//   //var url = 'http://video.google.com/timedtext?lang=de&v=jgdPdeQZ3T8&fmt=vtt';

//   request(url, function(error, response, body) {
//         // Check status code (200 is HTTP OK)
//         console.log("Status code: " + response.statusCode);
//         if (response.statusCode !== 200) {
//             //error
//             console.log(error + response.statusCode);
//         } else {
//             var sentences = [];
//             var txt = body.toString()
//             txt = txt.replace(/(\d\d:\d\d:\d\d\.\d\d\d\s*\-\-\>)/g, '\|$1');
//             var items = txt.split('|');
//             //console.log(items[1])
//             var str ='';
//             for(var i =0; i<items.length; i++)
//             {
//                 var temp = items[i].match(/(\d\d:\d\d:\d\d\.\d\d\d)\s*\-\-\>\s*(\d\d:\d\d:\d\d\.\d\d\d)(.*)((.*\n?)*)/)
//                 if(temp) {
//                     str+=`<li>${temp['1']} ${temp['2']} ${temp['4']}</li>`
//                     var startSec = convert2Sec(temp['1']);
//                     var endSec = convert2Sec(temp['2']);
//                     sentences.push([startSec,endSec,temp['4'].replace(/\n/g,' '),'']) //starttime, endtime, caption, userCaption
//                 }
//             }
            

//             var videoRecord =
//               {
//                 owner:`${req.user._id}`,
//                 caption:sentences,
//                 currentIndex:0,
//                 YouTubeVideoID:`${id}`,
//                 forkedFromVideoID:`${id}`,
//                 videoInfo:{}
//               }
//             getVideoInfo(videoRecord.YouTubeVideoID,function(result){
//               if(result.items)
//               {
//                 videoRecord.videoInfo=result.items[0];
//                 collectionVideo.insertOne(videoRecord,function(err, insertedDocument) {
//                   if (err) {err; }
//                   console.log('video inserted successfully:'+insertedDocument.insertedId)
//                   res.redirect(`/play/${insertedDocument.insertedId}`);
//                 })
//               }
//               else
//               {
//                 res.send('ther is no video information. error.')
//               }
//             });
      

            
//         }
//   })
// })


  
  
app.get('/',function(req,res){
  if(req.user) //logged in 
  {

    collectionVideo.find({owner:req.user._id},function(err, cursor) {
      if(err){return err;}
      cursor.toArray(function(err,foundVideoList){
        if(err){return err;}
        //console.log(foundVideoList)
        res.render('home_login',{videolist:foundVideoList})
      });
    })
  }
  else //logged out user
  {
    res.render('home');
  }
})

app.get('/play/:id',function(req,res){
  var video_id = ObjectId(req.params.id);
  console.log('/play/'+video_id);
  collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
    if (err) { console.log(err); return err; }
    if(foundVideo){
      //console.log("video found");
      //console.log(typeof foundVideo.caption)

      res.render('play.pug',{mytime:JSON.stringify(foundVideo)})
    }
  });

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


app.listen(process.env.PORT || config.NODE_PORT, process.env.IP || "0.0.0.0",function(){
  console.log('listening on %s',process.env.PORT||config.NODE_PORT)
})
