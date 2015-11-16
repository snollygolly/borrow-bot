$( document ).ready(function() {
  var page = window.location.pathname.split("/");
  var results = $("table").data("rows");
  if (page.length <= 2){
    // they are on the first page
    page = 1;
  }else{
    // they specified which page they are on
    page = Number(page[2]);
  }
  // check for next
  if (page <= 1){
    $(".next").toggleClass("disabled");
    $(".next a").attr("href", "#");
  }else{
    $(".next a").attr("href", "/dashboard/" + (page - 1));
  }
  // check for previous
  if (results != 25){
    $(".previous").toggleClass("disabled");
    $(".previous a").attr("href", "#");
  }else{
    $(".previous a").attr("href", "/dashboard/" + (page + 1));
  }

  $(".next").click(function(e){
    if ($(".next").hasClass("disabled")){
      e.preventDefault();
    }
  });

  $(".previous").click(function(e){
    if ($(".previous").hasClass("disabled")){
      e.preventDefault();
    }
  });

  $(".clickable-row").click(function(e) {
    window.document.location = "http://reddit.com/r/borrow/" + $(this).data("post-id");
  });
});
