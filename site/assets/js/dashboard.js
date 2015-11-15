$( document ).ready(function() {
  $(".clickable-row").click(function() {
        window.document.location = "http://reddit.com/r/borrow/" + $(this).data("post-id");
    });
});
