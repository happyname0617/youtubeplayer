var env = process.env.NODE_ENV || 'development';
var config = require('./config')[env];
//var dictionary = require('./dictionary');
var freqlist_DE = require('./DeReKoFreqList7500.js');
var DE_KR6800 = require('./DE_KR6800.js');
//var freqlist_DE_A1 = require('./freqlist_DE_A1');
var languageCode = require('./languageCode');
const express = require('express')
var session = require('express-session');
//var FileStore = require('session-file-store')(session);
const MongoStore = require('connect-mongo')(session);
var winston = require('winston');


var app = express()
var request = require('request');
var VError = require('verror');
var fs = require('fs')
var _ = require('underscore');
var bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectID;
var assert = require('assert');


var passport = require('passport')
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;

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

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      timestamp: true
    })
  ]
});
var mongodb;
var collectionUser;
var collectionVideo;
var collectionLog;
var collectionSentence;
var bundleVideoList =config.BUNDLE_VIDEO_LIST;
//["595a55225162b73b3ca72b91","5948eb94076d52107e95e38b","5948f20a076d52107e95e38d","5958baac7ed9c93c76967137","5958bf087ed9c93c76967138","5958bfab7ed9c93c76967139"];
//bundle video list
//var bundleVideoList =['5958bf087ed9c93c76967138','5948eb94076d52107e95e38b',,'5958bf087ed9c93c76967138','5958baac7ed9c93c76967137',];
function dbconnect(url)
{

  logger.info("DB connect")
  MongoClient.connect(url, function(err, db) {
     if (err) { 
        var error = new VError(err,"DB connect %s", url) 
        logger.error(error);
        return error; 
     }
    logger.info("Connected correctly to server");
    mongodb=db;
    collectionUser = mongodb.collection('User');
    collectionVideo = mongodb.collection('Video');
    collectionLog = mongodb.collection('Log');
    collectionSentence = mongodb.collection('Sentence');
  });
}

function dbdisconnect(){
  mongodb.close();
}

dbconnect(config.DB_URL);

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: config.GOOGLE_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    logger.info(profile.name)
    var _id = 'google:'+profile.id;;
      collectionUser.findOne({_id:_id},function(err, foundUser) {
        if (err) {logger.error('google strategy:',err); return done(err); }
        if(foundUser){
          logger.info("user already exist, proceed to login")
          done(null, foundUser);
        }
        else
        {
          logger.info("new user, proceed to login")
          var newuser = profile._json;
          newuser._id = _id;
          newuser.displayName = JSON.stringify(profile._json.name);
          newuser.langCode = 'de';
          newuser.scores = {'de':0};
          logger.info('new user displayName',newuser.displayName)

          collectionUser.insertOne(newuser,function(err, newuser) {
            if (err) {var newError = VError(err,'google strategy InsertOne'); return done(newError); }
            forkInit(_id,function(err){
              if(err)
              {
                var newError = VError(err,'google strategy forkInit');
                return done(newError);
              }
            });
	        });
          done(null,newuser);
        }
      });
  }
));

passport.use(
  new FacebookStrategy({
    clientID: config.FACEBOOK_APP_ID,
    clientSecret: config.FACEBOOK_APP_SECRET,
    callbackURL: config.FACEBOOK_CALLBACK_URL,
    profileFields:['id', 'email', 'gender', 'link', 'locale', 'name', 'timezone', 'verified', 'displayName','age_range']
  },
  function(accessToken, refreshToken, profile, done) {
    logger.info('facebook login:',profile.name);
    var _id = 'facebook:'+profile.id;;
      collectionUser.findOne({_id:_id},function(err, foundUser) {
        if (err) {logger.error(err); return done(err); }
        if(foundUser){
          logger.info("user already exist, proceed to login")
          done(null, foundUser);
        }
        else
        {
          logger.info("new user, proceed to login")
          var newuser = profile._json;
          newuser._id = _id;
          newuser.displayName = profile._json.name;
          newuser.langCode = 'de';
          newuser.scores = {'de':0};
          collectionUser.insertOne(newuser,function(err, newuser) {
            if (err) {var newError = VError(err,'facebook strategy insertOne'); return done(newError); }
            forkInit(_id,function(err){
              if(err)
              {
                var newError = VError(err,'facebook strategy forkInit');
                return done(newError);
              }
            });
	        });
          done(null,newuser);
        }
      });
  }

));


passport.serializeUser(function(user, done) {
  logger.info('         serializeUser',user._id, user.name);
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
 collectionUser.findOne({_id:id},function(err, foundUser) {
        if(err){logger.error('deserializeUser',err); return done(err);}
        if(foundUser)
        {
          logger.info('         deserializeUser ', id, foundUser.name)
          done(err, foundUser);
        }
        else
        {
          done('not existing FoundUser');
        }
  });

});

//add bundle videos
function forkInit(id,callback){
 bundleVideoList.forEach(function(item){
   forkVideo(item,id,function(err){
      if (err) { var newError = new VError(err,'forkInit'); callback(newError); }
   })
 })
 callback();
}
app.get('/admin/fork/:video_id/:userid',function(req,res){
  
  if(req.user) //logged in 
  {
    var videoID = req.params.video_id
    var userID = req.params.userid
    forkVideo(videoID,userID,function(err){
      if (err) { console.log(err); return err; }
            res.redirect('/');
    });
    
  }
  res.redirect('/');
});


function generateForEachLevel(freqListDE) //for display purpose
{
  var level = {A1:700,A2:1200,B1a:1750,B1b:2200,B2a:2800,B2b:3500,C1:5500,C2:7500};
  var A1={};
  var A2={};
  var B1a={};
  var B1b={};
  var B2a={};
  var B2b={};
  var C1={};
  var C2={};
  var count = 0;
  for(var key in freqListDE)
  {
          count++;
          if(count<=level.A1)
          {
              A1[key] = freqListDE[key];
          }
          else if(count<=level.A2)
          {
              A2[key] = freqListDE[key];
          }
          else if(count<=level.B1a)
          {
              B1a[key] = freqListDE[key];
          }
          else if(count<=level.B1b)
          {
              B1b[key] = freqListDE[key];
          }
          else if(count<=level.B2a)
          {
              B2a[key] = freqListDE[key];
          }
          else if(count<=level.B2b)
          {
              B2b[key] = freqListDE[key];
          }
          else if(count<=level.C1)
          {
              C1[key] = freqListDE[key];
          }
          else if(count<=level.C2)
          {
              C2[key] = freqListDE[key];
          }
   
  }
  return {A1:A1,A2:A2,B1a:B1a,B1b:B1b,B2a:B2a,B2b:B2b,C1:C1,C2:C2};
}
app.get('/voca',function(req, res) {
  if(req.user) //logged in 
  {
    collectionUser.findOne({_id:req.user._id},function(err, foundUser) {
      if(err){logger.error('/voca fineOne',err);return err;}
      if(!foundUser.freqlist_DE)
      {
        collectionUser.updateOne({_id:req.user._id},{ $set: {freqlist_DE:freqlist_DE}},function(err){
          if(err){logger.error('/voca updateOne',err); return err}
          var levels = generateForEachLevel(freqlist_DE);
          res.render('voka',{voca_A1:levels.A1,voca_A2:levels.A2,
                            voca_B1a:levels.B1a,voca_B1b:levels.B1b,
                            voca_B2a:levels.B2a,voca_B2b:levels.B2b,
                            voca_C1:levels.C1,voca_C2:levels.C2 })

        });
      }
      else
      {
        var levels = generateForEachLevel(foundUser.freqlist_DE);
        res.render('voka',{voca_A1:levels.A1,voca_A2:levels.A2,
                          voca_B1a:levels.B1a,voca_B1b:levels.B1b,
                          voca_B2a:levels.B2a,voca_B2b:levels.B2b,
                          voca_C1:levels.C1,voca_C2:levels.C2 })
      }
    })
  }
  else{
    logger.info('/voca log logged in access',req.headers);
    res.send('/voca log logged in access')
  }
})
app.get('/publish/:video_id',function(req,res){
  
  if(req.user) //logged in 
  {
    var videoID = req.params.video_id
    var video_id = ObjectId(videoID);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        console.log("video found, updated it successfully")
        collectionVideo.updateOne({_id:video_id},{ $set: { owner : "public" } })
        res.redirect('/');
      }
      else
      {
          console.log('video is not existing! something wrong')
      }
    });
  }
  else
  {
    res.redirect('/');
  }
})

app.get('/fork/:video_id',function(req, res) {
  if(req.user) //logged in 
  {
    var video_id = ObjectId(req.params.video_id);
    logger.info('/fork/'+video_id, req.user.name);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { console.log(err); return err; }
      if(foundVideo){
        //check whether same video exist
        collectionVideo.findOne({owner:req.user._id,forkedFromVideoID:req.params.video_id},function(err, sameVideo)
        {
          if (err) { console.log(err); return err; }
            if(sameVideo){
              logger.info("same video exist");
              res.redirect('/');
            }
            else
            {
              //not exist then add
              forkVideo(req.params.video_id,req.user._id,function(err){
                if (err) { console.log(err); return err; }
                logger.info('/fork/'+video_id,foundVideo.videoTitle, req.user.name);
                res.redirect('/');
              });
              
            }
        });
      }
      else
      {
        console.log('video is not exist :error something wrong')
        res.redirect('/');

      }
    });

  }
  else{
    res.redirect('/')
  } 
})
//http://www.typingtube.com/fork/595a55225162b73b3ca72b91
// app.get('/fork',function(req,res){
//   forkInit(req.user._id);
//   //add bundle videos
// // bundleVideoList.forEach(function(item){
// //   forkVideo(item,req.user._id)
// // })
  
//   res.redirect('/');

// })

// app.get('/auth/logout', function(req, res){
//   logger.info('/auth/logout', req.user.name);
//   req.logout();
//   req.session.save(function(){
//     res.redirect('/');
//   });
// });

app.get('/auth/logout', function(req, res){
  if(req.user)
  {
    logger.info('/auth/logout', req.user._id, req.user.name);
    req.logout();
    req.session.save(function(){
      res.redirect('/');
    });
  }
  else{
    logger.info('/auth/logout not logged in approach')
    res.redirect('/');
  }
});

app.get('/about',function(req,res){
  if(req.user)
  {
    res.render('about.pug')
  }
  else
  {
    res.redirect('/')
  }
})

app.get('/create',function(req,res){
  if(req.user)
  {
    res.render('create.pug')
  }
  else
  {
    res.redirect('/');
  }
})

function VideoFind(query,callback)
{
  collectionVideo.find(query,function(err, cursor) {
      if(err){console.log(err); return err;}
      cursor.toArray(function(err,result){
        if(err){console.log(err); return err;}
        callback(result);
      });
  })
}

function findSentence(query,callback){
  collectionSentence.find(query,function(err, cursor) {
      if(err){console.log(err); return err;}
      cursor.toArray(function(err,result){
        if(err){console.log(err); return err;}
        callback(result);
      });
  })

  
}
app.get('/feed',function(req,res){
  if(req.user) //logged in 
  {
    logger.info('/feed',req.user._id,req.user.name)
    VideoFind({"owner":"public",videoCaptionLangCode:req.user.langCode},function(publicList){
      VideoFind({"owner":req.user._id},function(userList){
        var newList=[];
        publicList.forEach(function(publicItem){
          //if user have already this, then skip
          var checkExist = userList.some(function(userItem){
            return userItem.forkedFromVideoID==publicItem._id;
          })
          
          if(!checkExist)
          {
            newList.push(publicItem);
          }
        })
        res.render('feed.pug',{videolist:newList})
      })
    })
    // collectionVideo.find({"owner":"public"},function(err, cursor) {
    //   if(err){console.log(err); return err;}
    //   cursor.toArray(function(err,foundVideoList){
    //     if(err){console.log(err); return err;}
    //     //console.log(foundVideoList)
    //     res.render('feed.pug',{videolist:foundVideoList})
    //   });
    // })
  }
  else //logged out user
  {
    res.redirect('/');
  }
})

app.get('/ranking',function(req,res){
  if(req.user) //logged in 
  {
    logger.info('/ranking',req.user._id,req.user.name);
    var langCode = req.user.langCode;
    var sortstr = 'scores'+'.'+langCode;
    logger.info('sortstr', sortstr)
    var query_search = {};
    query_search[sortstr]= {$exists: true};
    var query_sort={};
    query_sort[sortstr]=-1;
    collectionUser.find(query_search).sort(query_sort).limit(10).toArray(function(err,list){
              logger.info(list.length)
        if (err) {console.log(err); return err; }
        list.forEach(function(item){
          item.score = item.scores[langCode];
        })
        logger.info(list.length)
        res.render('ranking.pug',{ranking:list})
    })
    
  }
  else //logged out user
  {
    logger.info('/ranking not logged in access')
    res.redirect('/');
  }
})
app.get('/forum',function(req,res){
  if(req.user) //logged in 
  {
    logger.info('/forum',req.user._id,req.user.name);
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





// app.get('/login',function(req, res) {
//     res.render('login.pug')
// })


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


app.get('/auth/google',passport.authenticate('google', { scope: ['profile','email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { successRedirect:'/',
                                    failureRedirect: '/' }));

function addScore(userID,langCode, additionalScore,callback)
{
  var query ={}
  query['scores.'+langCode] = additionalScore;
  collectionUser.updateOne({_id:userID},{$inc:query},function(err)
  {
    if(err)
    {
      callback(err);
    }
    else
    {
      callback(null);
    }
  })
}

function translate(source,target,text,callback)
{
  var url = 'https://translation.googleapis.com/language/translate/v2';
  key=config.GOOGLE_TRANSLATE_API_KEY;
  var qs = {
  'q': text,
  'source': source,
  'target': target,
  'format': 'text',
  'key':key
  }

  request({uri:url,qs:qs}, function(error, response, body) {
        // Check status code (200 is HTTP OK)
        console.log("Status code: " + response.statusCode);
        if (response.statusCode !== 200) {
            //error
            logger.error(error + response.statusCode);
            callback(error);
        } else {
          logger.info(body)
          logger.info(typeof body);
          var json = JSON.parse(body);
          callback(null,json.data.translations[0].translatedText);
        }
  })
//  var result;
//  return result;
}
app.get('/sentenceinfo',function(req, res) {
    var str = req.query.sentence;
    
    var words = str.toLocaleLowerCase().split(/[^\w|äöüÄÖÜß]+/); //work only for german and english at the moment
    logger.info(words);
    var result = {words:[],translatedText:{}};
    translate("de","en",str,function(err,translatedTxt){
      logger.info(translatedTxt);
      result.translatedText = translatedTxt.trim();
      words.forEach(function(item){
        if(freqlist_DE[item])
        {
          var searchkey = freqlist_DE[item].infinitive.toLocaleLowerCase()

          if(DE_KR6800[searchkey])
          {
            freqlist_DE[item].translation = DE_KR6800[searchkey].translation; 
            logger.info('dict trans:',DE_KR6800[searchkey])
          }
          else{
            freqlist_DE[item].translation ='';
          }
          result.words.push(freqlist_DE[item]);
          logger.info(item,freqlist_DE[item].rank,freqlist_DE[item].infinitive,freqlist_DE[item].type,freqlist_DE[item].translation)
        }
      })
      res.json(result);

    });
})

function markVocaTable(newSentence,freqlist,callback)
{
  try
  {
    logger.info(typeof newSentence);
    var words = newSentence.toLocaleLowerCase().split(/[^\w|äöüÄÖÜß]+/); //work only for german and english at the moment
    logger.info(words);
    words.forEach(function(item){
      if(freqlist[item])
      {
        freqlist[item].frequency++;
        logger.info(item,freqlist[item].rank,freqlist[item].frequency)
      }
    })
    callback(null,freqlist);
  }
  catch(err)
  {
    logger.error('markVocaTable',err);
    callback(err);
  }
}

function markVocaTableDB(newSentence,userID,callback)
{
    collectionUser.findOne({_id:userID},function(err, foundUser) {
      if(err){logger.error('markVocaTableDB',err);return callback(err);}
      if(!foundUser)
      {
        return callback(new VError('no foundUser'))
      }
      var prevfreqList = foundUser.freqlist_DE;
      if(!prevfreqList)
      {
        prevfreqList = freqlist_DE; //set defaultValue
      }
      markVocaTable(newSentence,prevfreqList,function(err,updatedFreqList){
          if(err){logger.error('markVocaTableDB',err);return callback(err);}
          
          collectionUser.updateOne({_id:userID},{ $set: {freqlist_DE:updatedFreqList}},function(err){
            if(err){logger.error('markVocaTableDB',err);return  callback(err)}
            return callback(null);
          })
        
      })
    })
}
app.post('/update/sentence', function(req, res){
  res.send('okay');
  if(req.user)
  {
    logger.info('isCorrect',req.body.isCorrect,'typeof',typeof req.body.isCorrect);
    logger.info('isCorrectisCorrectAtOnce',req.body.isCorrectAtOnce);
    var videoID = req.body.videoID;
    var index = parseInt(req.body.index);
    var isCorrect = req.body.isCorrect=='true'?1:0;
    var trials = req.body.trials;
    var sentenceID = videoID+':'+index;        
    //when correct==true, give a score to user
    logger.info('/update/sentence videoID',videoID);
    logger.info('/update/sentence index',index);
    logger.info('/update/sentence correct',isCorrect);
    logger.info('/update/sentence trials',trials);
    var video_id = ObjectId(videoID);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        collectionSentence.findOne({_id:sentenceID},function(err,result){
          // console.log("err:",err);
          // console.log("result:",result);
          if (err) {console.log('some error:',err); return err; }
          
          if(result)
          {
            logger.info('sentence exist, update it')
            collectionSentence.updateOne({_id:sentenceID},{$inc:{"trials":trials,"correct":isCorrect}})
          }
          else 
          {
            logger.info('sentence does not exist, add it new')
            var newSentence = 
              {
                _id:sentenceID,
                owner:req.user._id,
                languageCode:foundVideo.videoCaptionLangCode,
                sentence:foundVideo.caption[index],
                sentence_frontNeighbour:foundVideo.caption.slice(index-3,index),
                sentence_postNeighbour:foundVideo.caption.slice(index+1,index+3),//TODO
                sentenceFreq:1,
                wordsFreq:[1,2,3,4],
                videoID:videoID,
                youtubeVideoId:foundVideo.YouTubeVideoID,
                trials:trials,
                correct:isCorrect
              }
              insertSentence(newSentence,function(err,inserted_id){
                if (err) {console.log(err); return err; }
                logger.info('new sentence successfully added',inserted_id);
              });

          }
          //foundVideo.caption[index][3] = sentence;
          logger.info("/update video found, updated it successfully",req.user._id, req.user.name, (index+2)+'/'+foundVideo.caption.length,foundVideo.videoTitle)
          //var targetSentence= "$.caption."+index+".3";
          
          collectionVideo.updateOne({_id:video_id},{ $set: {currentIndex:index+1} }) 
          
          var newScore = isCorrect/(trials+1);
          addScore(req.user._id,req.user.langCode,newScore,function(err)
          {
            if (err) {console.log(err); return err; }
            logger.info('New score added to User',newScore,req.user.name);
            //mark at voca table
            markVocaTableDB(foundVideo.caption[index][2],req.user._id,function(err){
              if (err) {logger.error(err); return err; }
            });
          });
        })

      }
      else
      {
          logging.info('/update video is not existing! something wrong')
      }
    });
  }
  else{
    logging.info('/update/sentence not logged in approach')
    
  }

});

app.post('/update/user', function(req, res){
  if(req.user)
  {
    res.send('okay update user');
    var displayName = req.body.displayName?req.body.displayName:req.user.displayName;
    var langCode = req.body.langCode;
    logger.info('update user displayName',displayName);
    logger.info('update user langCode',langCode);
    collectionUser.updateOne({_id:req.user._id},{ $set: {displayName:displayName,langCode:langCode}});
  }
  else{
    logging.info('/update user not logged in approach')
    res.redirect('/');
  }

});
app.post('/update', function(req, res){
  if(req.user)
  {
    res.send('okay update');
    //TODO user login status check
    //console.log(req.body.videoRecord)
    var videoRecord = JSON.parse(req.body.videoRecord);
  
    var video_id = ObjectId(videoRecord._id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        logger.info("/update video found, updated it successfully",req.user._id, req.user.name, videoRecord.currentIndex+'/'+videoRecord.caption.length,foundVideo.videoTitle)
        collectionVideo.updateOne({_id:video_id},{ $set: { caption : videoRecord.caption, currentIndex:videoRecord.currentIndex } })
      }
      else
      {
          logging.info('/update video is not existing! something wrong')
      }
    });
  }
  else{
    logging.info('/update not logged in approach')
    res.redirect('/');
  }

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
    logger.info("/delete/ "+req.params.youtubeVideoId);

    collectionVideo.findOne({_id:YoutubeVideoId},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        logger.info("/delete/  video found",foundVideo.videoTitle);
        //console.log(typeof foundVideo.caption)
        if(foundVideo.owner==req.user._id)
        {
          collectionVideo.remove({_id:YoutubeVideoId},function(err,result){
            if (err) {console.log(err); return err; }
            logger.info('/delete/ successfully deleted', foundVideo.videoTitle)
            res.redirect('/')
          })   
        }
        else
        {
          logger.info('/delete/ the video is not owned by you');
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

function  insertSentence(sentence,callback)
{
  collectionSentence.insertOne(sentence,function(err, insertedDocument) {
          if (err) {console.log(err);callback(err)}
          logger.info('insertSentence: inserted successfully:'+insertedDocument.insertedId);
          callback(null,insertedDocument.insertedId);
        })
}

function forkVideo(videoRecordId,userID,callback)//fork given video to the given user
{
    var video_id = ObjectId(videoRecordId);

    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) {console.log(err); return err; }
      if(foundVideo){
        logger.info("forkVideo: video found")
        var newVideo = foundVideo;
        delete newVideo._id
        newVideo.owner=userID;
        newVideo.caption=clearCaptionUserAnswer(foundVideo.caption);
        newVideo.currentIndex=0;
        newVideo.forkedFromVideoID=videoRecordId;

        collectionVideo.insertOne(newVideo,function(err, insertedDocument) {
          if (err) {console.log(err); return err; }
          logger.info('forkVideo: video forked successfully:'+insertedDocument.insertedId);
          callback();
        })

      }
      else
      {
          logger.info('video is not existing! something wrong'+videoRecordId)
          callback();
      }
    });
 
}
app.post('/newvideo',function(req, res) {
  var YouTubeVideoID=req.body.youtubeVideoId;
  var langCode=req.body.lang;
  logger.info('/newvideo '+YouTubeVideoID+' '+langCode)
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
          res.redirect(`/play_modify/${insertedDocument.insertedId}`);
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

  
app.get('/mypage',function(req,res){
  if(req.user) //logged in 
  {
    logger.info('/mypage',req.user.displayName,req.user._id);
    collectionUser.findOne({_id:req.user._id},function(err, foundUser) {
      if(err){logger.error('/mypage',err);return err;}
        if(foundUser)
        {
          var langCode = foundUser.langCode?foundUser.langCode:"en";
          logger.info('langCode from DB',typeof foundUser.langCode);
          logger.info('langCode selected',langCode);
          var scores = foundUser.scores?foundUser.scores:0;
          var score;
          if(scores)
          {
            score = scores[langCode]?scores[langCode]:0
          }
          else
          {
            score = 0;
          }
          res.render('mypage.pug',{score:score,displayName:foundUser.displayName,language:"English",ranking:'12',langCode:langCode})
        }
        else{
          res.send('/mypage no user found')
        }
    })
  }
  else
  {
    logger.error('/mypage not logged in access')
    res.send('log logged in access');
  }

})

  
  
app.get('/',function(req,res){
  if(req.user) //logged in 
  {
    logger.info('USER INFO',req.headers);
    var currentTime = new Date().getTime();
    collectionUser.updateOne({_id:req.user._id},{ $set: {lastTime:currentTime}});
    logger.info('/',req.user._id, req.user.name);
    collectionVideo.find({owner:req.user._id,videoCaptionLangCode:req.user.langCode},function(err, cursor) {
      if(err){return err;}
      cursor.toArray(function(err,foundVideoList){
        if(err){return err;}
        logger.info('foundVideoList length',foundVideoList.length);
        res.render('home_login',{videolist:foundVideoList})
      });
    })
  }
  else //logged out user
  {
    res.render('home');
  }
})

function getCurrentTimeString()
{
  return new Date(getCurrentTime()).toLocaleString();
}

function getCurrentTime()
{
  return new Date().getTime();
}

var LogType = {INFO_SERVER:{value:0,name:'INFO_SERVER'},INFO_CLIENT:{value:1,name:'INFO_CLIENT'},ERROR_SERVER:{value:2,name:'ERROR_SERVER'},ERROR_CLIENT:{value:3,name:'ERROR_CLIENT'}}

function logging(location,logType,userID,message1, message2)
{
  var currentTime = new Date().getTime();
  var currentTimeString = new Date(currentTime).toLocaleString();
  
  var log = {"timestamp":currentTime ,"timestring":currentTimeString,"type":logType,"userID":userID,"location":location,"message1":message1, "message2":message2}; 
  collectionLog.insertOne(log,function(err, insertedDocument) {
          if (err) {console.log(err); return err; }
          console.log('LOG:', log);
  })
}


app.get('/preview/:id',function(req, res) {
  try{
    if(req.user) {
      var video_id = ObjectId(req.params.id);
      logging('/preview/',LogType.INFO_SERVER,req.user._id,req.params.id,"user found");
      collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
        if (err) { logging('/preview/',LogType.ERROR_SERVER,req.user._id,req.params.id,err); return err; }
        if(foundVideo){
          res.render('preview.pug',{mytime:JSON.stringify(foundVideo)})
        }
      });    
    }
    else
    {
      logging('/preview/',LogType.INFO_SERVER,"none",req.params.id,"user not logged in");
      res.redirect('/');
    }
  }catch(err)
  {
    logging('/play_modify/',LogType.ERROR_SERVER,'',req.params.id,err);
  }
})

app.get('/play_modify/:id',function(req,res){
  if(req.user)  //is logged in?
  {
    var video_id = ObjectId(req.params.id);
    console.log('/play_modify/'+video_id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { console.log(err); return err; }
      if(foundVideo){
        //video owner == user then allow to modify 
        
        //console.log("video found");
        //console.log(typeof foundVideo.caption)
  
        res.render('play_modify.pug',{mytime:JSON.stringify(foundVideo)})
        
        //else - send message that not allowed to modify
        
      }
    });
  }
  else
  {
    res.redirect('/');
  }

})

app.get('/study/:id',function(req,res){
  if(req.user)  //is logged in?
  {
    var video_id = ObjectId(req.params.id);
    console.log('/review/'+video_id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { console.log(err); return err; }
      if(foundVideo){
        //video owner == user then allow to modify 
        
        //console.log("video found");
        //console.log(typeof foundVideo.caption)
  
        res.render('study.pug',{mytime:JSON.stringify(foundVideo)})
        
        //else - send message that not allowed to modify
        
      }
    });
  }
  else
  {
    res.redirect('/');
  }

})
app.get('/playagain/:id',function(req,res){
  if(req.user) //logged in?
  {
    var video_id = ObjectId(req.params.id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { logger.error('/playagain/'+req.params.id,req.user.name,err)}
      if(foundVideo){
        logger.info('/playagain/'+req.params.id,req.user.name,foundVideo.videoTitle);
        foundVideo.currentIndex=0;
        foundVideo.caption = clearCaptionUserAnswer(foundVideo.caption);
        res.render('play.pug',{mytime:JSON.stringify(foundVideo)})
        collectionVideo.updateOne({_id:video_id},{ $set: { caption : foundVideo.caption, currentIndex:foundVideo.currentIndex } })
      }
    });
  }
  else
  {
    logger.info('/playagain'+ 'not logged in access')
    res.redirect('/')
  }
})


app.get('/play/:id',function(req,res){
  if(req.user) //logged in?
  {
    var video_id = ObjectId(req.params.id);
    collectionVideo.findOne({_id:video_id},function(err, foundVideo) {
      if (err) { logger.error('/play/'+req.params.id,req.user.name,err)}
      if(foundVideo){
        logger.info('/play/'+req.params.id,req.user.name,foundVideo.videoTitle);
        res.render('play.pug',{mytime:JSON.stringify(foundVideo)})
      }
    });
  }
  else
  {
    logger.info('/play'+ 'not logged in access')
    res.redirect('/')
  }

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
  logger.info('listening on %s',process.env.PORT||config.NODE_PORT)
})
