const express = require('express')
var session = require('express-session');
var FileStore = require('session-file-store')(session);
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
var FACEBOOK_APP_SECRET='e765d4f33eb9adcca3ba7fdcb07c4dbe';
var FACEBOOK_APP_ID = '120280471896762'
var db_url = 'mongodb://localhost:27017/typingtube';

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.set('view engine', 'pug');
app.set('views', './views');

app.use(session({
  secret: '1234DSFs@adf1234!@#$asd',
  resave: false,
  saveUninitialized: true,
  store:new FileStore()
}));

var mongodb;
var collectionUser;
var collectionVideo;
function dbconnect(url)
{
  MongoClient.connect(url, function(err, db) {
     if (err) { return err; }
    console.log("Connected correctly to server");
    mongodb=db;
    collectionUser = mongodb.collection('User');
    collectionVideo = mongodb.collection('Video');
  });
}

function dbdisconnect(){
  mongodb.close();
}

dbconnect(db_url);
app.use(passport.initialize());
app.use(passport.session());
passport.use(
  new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: "https://youtubeplayer-happyname0617.c9users.io/auth/facebook/callback",
    profileFields:['id', 'email', 'gender', 'link', 'locale', 'name', 'timezone', 'updated_time', 'verified', 'displayName']
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile);
    var _id = 'facebook:'+profile.id;;
      collectionUser.findOne({_id:_id},function(err, foundUser) {
        if (err) { return done(err); }
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
            if (err) { return done(err); }
            done(null, newuser);
          });

        }
      });
      // collectionUser.insertOne(newuser);
      // done(null, newuser);
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

app.get('/auth/logout', function(req, res){
  req.logout();
  req.session.save(function(){
    res.redirect('/');
  });
});



app.get('/dbtest',function(req, res) {
    // Connection URL

    // Use connect method to connect to the server
    MongoClient.connect(db_url, function(err, db) {
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
                                      failureRedirect: '/login' }));




app.post('/save', function(req, res){
  console.log(req.body.videoRecord)
  var videoRecord = JSON.parse(req.body.videoRecord);

  var video_id = ObjectId(videoRecord._id);
  collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
    if (err) { return err; }
    if(foundVideo){
      console.log("video found, updated it successfully")
      collectionVideo.updateOne({_id:video_id},{ $set: { "caption" : videoRecord.caption } })
    }
    else
    {
        console.log('video is not existing! something wrong')
    }
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

//get caption with given language from youtube.com //create new from youtube.com
app.get('/get/:id',function(req,res)
{
  console.log('/get/id')
    var id=req.params.id;
    var lang=req.query.lang;//'de'; //default language is english (see below)
    var url = 'http://video.google.com/timedtext?lang='+lang+'&v='+id+'&fmt=vtt';
    console.log('get id lang '+ url);
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
            

            var videoRecord =
              {
                owner:`${req.user._id}`,
                caption:sentences,
                currentIndex:0,
                YouTubeVideoID:`${id}`,
                forkedFromVideoID:`${id}`
              }

            collectionVideo.insertOne(videoRecord,function(err, insertedDocument) {
              if (err) {err; }
              console.log('video inserted successfully:'+insertedDocument.insertedId)
              res.redirect(`/play/${insertedDocument.insertedId}`);

            });
      

            
        }
  })
})


  
  
app.get('/',function(req,res){
  if(req.user) //logged in 
  {
    res.render('home_login')
  }
  else //logged out user
  {
    res.render('home');
  }
})

app.get('/play/:id',function(req,res){
  var video_id = ObjectId(req.params.id);
  console.log('/play/id/'+video_id);
  collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
    if (err) { return err; }
    if(foundVideo){
      console.log("video found");
      res.render('play.pug',{mytime:JSON.stringify(foundVideo)})
    }
  });

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
