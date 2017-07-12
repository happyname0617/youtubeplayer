//add all displany name if not exist :facebook
db.User.find({"displayName":{$exists: false},"link":{$exists: true}}).forEach(
       function(e, i){ 
              e.displayName=e.name;
           db.User.save(e);
       }
    )
    
//add all displany name if not exist :google    
    db.User.find({"displayName":{$exists: false},"url":{$exists: true}}).forEach(
       function(e, i){ 
               e.displayName=e.name.givenName+' '+e.name.familyName;
           db.User.save(e);
       }
    )

//delete all displany name if exist   
    db.User.update({},{$unset:{displayName:''}},{multi:1})
    
//show all user with display name
db.User.find({},{displayName:1,name:1})

//calucate Score from exiting user
    db.User.find({"score":{$exists: false}}).forEach(
       function(e, i){ 
         var score = 0;
         db.Video.find({owner:e._id}).forEach(function(e2,i2)
         {
           score = score + e2.currentIndex;
         })
         
         e.score = score;
         db.User.save(e);
       }
    )

