$( document ).ready(function() {
  $( "#settings-form" ).submit(function( event ) {
    /* Get input values from form */
    var values = $("#settings-form").serializeArray();
    /* Because serializeArray() ignores unset checkboxes and radio buttons: */
    values = values.concat(
      $('#settings-form input[type=checkbox]:not(:checked)').map(
        function() {
          return {"name": this.name, "value": 0}
        }).get()
    );
    $.ajax({
      type: 'PUT', // Use POST with X-HTTP-Method-Override or a straight PUT if appropriate.
      dataType: 'json', // Set datatype - affects Accept header
      url: "/account", // A valid URL
      data: values
    }).done(function(result) {
      if (result.message === "Successful!"){
        displayAlert("success", "Your settings have been updated!");
      }else{
        displayAlert("warning", "Oh no!  Something has gone wrong(" + result.message + ")");
      }
    }).fail(function(result) {
      displayAlert("danger", "Oh no!  Something has gone terribly wrong(" + result + ")");
    });
    event.preventDefault();
  });
});


function displayAlert(type, message){
  alert = '<div class="alert alert-' + type + ' alert-dismissible" role="alert">';
  alert += '<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' + message + '</div>';
  $("#alert-container").html(alert);
}
