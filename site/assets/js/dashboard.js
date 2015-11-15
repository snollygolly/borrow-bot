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
  if (page <= 1){
    $(".next").toggleClass("disabled");
    $('.next').prop("disabled", true);
  }
  if (results != 25){
    $(".previous").toggleClass("disabled");
    $('.previous').prop("disabled", true);
  }
  $(".next a").attr("href", "/dashboard/" + (page - 1));
  $(".previous a").attr("href", "/dashboard/" + (page + 1));

  $(".clickable-row").click(function() {
    window.document.location = "http://reddit.com/r/borrow/" + $(this).data("post-id");
  });
});
