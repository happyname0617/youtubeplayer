const express = require('express')
var cookieParser = require('cookie-parser')

var app = express()
var salt='slwkejlid!2lksldf!#@#@!)j'
app.use(cookieParser(salt))


var products = {
  2017001:{title:'IPhone7',price:'204.5 euro'},
  2017002:{title:'MI band 2', price:'53 euro'},
  2017003:{title:'macbook 12 inch', price:'400 euro'}
}

app.get('/products',function(req,res){
  var str = '';
  for(var id in products)
  {
    str+=`<li>${products[id].title} ${products[id].price}<a href=/cart/${id}>BUY</a></li>`
  }
  res.send(`<h1>product lists</h1><ul>${str}</ul><a href='/cart'>view cart</a>`)
})

//var cart={}//{2017001:1,2017002:3}

app.get('/cart/empty/:id',function(req,res){
  console.log('empty/'+req.params.id);
  if(req.params.id ==0)
  {
    res.clearCookie('cart');
  }
  else{
    var cart = req.signedCookies.cart;
    delete cart[req.params.id]
    res.cookie('cart',cart,{signed:true})
    //res.send(req.params.id)
  }
  res.redirect('/cart')
})
app.get('/cart/:id',function(req,res){
  console.log(req.params.id);
  if(req.signedCookies.cart)
  {
    var cart = req.signedCookies.cart
  }
  else
  {
    cart ={}
  }
  
  if(cart[req.params.id])
  {
    cart[req.params.id] =  parseInt(cart[req.params.id])+1
  }
  else
  {
    cart[req.params.id] = 1;
  }
  res.cookie('cart',cart,{signed:true})
//  res.send(cart)
  res.redirect('/cart')
})

app.get('/cart',function(req,res){
  var cart = req.signedCookies.cart
  var str = '';
  for(var id in cart)
  {
    str+=`<li>${products[id].title} ${products[id].price} Amount:${cart[id]} <a href=/cart/empty/${id}>remove</a></li>`
  }
  res.send(`<h1>Cart</h1><ul>${str}</ul>
  <a href='/products'>go on shopping</a>
  <a href='/cart/empty/0'>empty carts</a>
  <a href='/checkout'>check out</a>`)

})
app.get('/',function(req,res){
  console.log('Cookies: ', req.signedCookies)
  var count = 0;
  if(req.signedCookies.count)
  {
    count = parseInt(req.signedCookies.count)
    
  }
  else
  {
    count = 0;
  }
  count = count +1
  res.cookie('count',count,{signed:true})
  res.send('current cookies: '+count)
})

app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0",function(){
  console.log('listening on %s',process.env.PORT||3000)
})
// server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
//   var addr = server.address();
//   console.log("Chat server listening at", addr.address + ":" + addr.port);
// });
