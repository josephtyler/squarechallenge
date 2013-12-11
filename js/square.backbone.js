$(function(){

  // Square model
  window.App.Models.SquareModel = Backbone.Model.extend({
    defaults: {
      square_id: false,
      hot: false,
      selected: false,
      highlight: false
    },
    validate: function(attrs) {
      if (attrs.square_id === undefined) {
        return "You must set a square_id.";
      }
    },
    isHot: function() {
      return this.attributes.hot;
    },
    isSelected: function() {
      return this.attributes.selected;
    },
    isHighlighted: function() {
      return this.attributes.highlight;
    },
    /*
     * Adds a highlight to a single selected square
     * The actual css for the highlight is applied by the square view as 
     * it is listening for this.attributes.highlight status to change
     */
    addHighlight: function() {
      this.set( { highlight: true } );
      var m = this;
      window.App.appView.freezeBoard();
      // Set a 5 second delay to unhighlight the chosen square
      setTimeout( function() { 
        m.set( { highlight: false } ); 
        window.App.appView.unfreezeBoard();
      }, 5000 );
    }
  });

  // Square Collection
  window.App.Collections.Squares = Backbone.Collection.extend({
    model: window.App.Models.SquareModel
  });

  // Square view
  window.App.Views.SquareView = Backbone.View.extend({
    className: 'square',  
    events: {
      'click': 'selectSquare'
    },
    initialize: function() {
      this.listenTo( this.model, "change:highlight", this.changeHighlight );
    },
    render: function() {
      return this;
    },
    selectSquare: function( e ) {
      if ( this.model.isSelected() || window.App.appView.frozenBoard ) {
        return;
      }
      if ( this.model.isHot() ) {
        this.$el.addClass( "selected" );
        this.model.set( "selected", true );
        this.didYouWin();
      } else {
        this.$el.addClass( "wrong" );
        this.youLost();
      }
    },
    didYouWin: function() {
      var selectedSquares = window.App.squares.where( { selected: true } );
      var total = Math.round( window.App.config.rows * window.App.config.cols * window.App.config.hotRatio );
      if ( selectedSquares.length >= total ) {
        window.App.appView.successMessage();
				window.App.appView.freezeBoard();
      } 
    },
    youLost: function() {
      window.App.appView.errorMessage();
      window.App.appView.freezeBoard();
    },
    changeHighlight: function() {
      var hl = this.model.get( "highlight" );
      if ( hl ) {
        this.$el.addClass( "highlight" );
      } else {
        this.$el.removeClass( "highlight" );
      }
    }
  });

  // App View
  window.App.Views.AppView = Backbone.View.extend({
    template: _.template( $("#app-template").html() ),
    frozenBoard: false,
    events: {
      'click #startGame': 'startGame',
      'click #resetGame': 'resetGame'
    },
    initialize: function() {
      $(".container").html( this.render().el );
      this.buildGame();
      this.controls( "startGame" );
    },
    render: function() {
      this.$el.html( this.template() );
      return this;
    },
    /*
     * This method builds the game, but the game isn't started
     * until the startGame method is called
     */
    buildGame: function() {
      var hotList = this.randomizeHotList();
      $board = $( "<div></div>" );
      // Loop through rows
      for ( var i = 1; i <= window.App.config.rows; i++ ) {
        // Create the jQuery row and rowContainer elements
        $row = $( "<div></div>" ).addClass( "row" );
        $rowContainer = $( "<div></div>" )
          .addClass( "col-sm-8" )
          .addClass( "col-sm-offset-2" )
          .addClass( "col-md-6" )
          .addClass( "col-md-offset-3" );
        $row.append( $rowContainer );
        // Loop through cols appending squares to the row
        for ( var j = 1; j <= window.App.config.cols; j++ ) {
          var square_id = this.generateId( i, j );
          // Temporary binding to generate square view 
          window.App.squares.on( "add", function( m ) {
            // Use a callback to ensure the square model gets added properly before making the view
            var view = new window.App.Views.SquareView( { model: m } );
            $rowContainer.append( view.render().el );
          });
          var data = { square_id: square_id };
          if ( $.inArray( square_id, hotList ) != -1 ) {
            data.hot = true;
          } 
          window.App.squares.add( data );
          window.App.squares.off( "add" );
        }
        $board.append( $row );
      }
      $("#gameContainer").html( $board );
      // Every time we add squares for a new game, adjust square height
      this.squareHeight();
      // Freeze the board after building, until its intentionally unfrozen
      this.freezeBoard();
    },
    /*
     * Start the game
     * The board should already be built, so we will shot the hot squares
     * and show the proper controls
     */
    startGame: function() {
      this.showHotSquares();
      this.controls( "gameStarted" );
    },
    /*
     * Reset the game
     */
    resetGame: function() {
      window.App.squares.reset();
      this.buildGame();
      this.startGame();
      this.clearMessages();
    },
    /*
     * Freeze the board so no selections can be made
     * The square view checks to see if the board is frozen before it
     * attempts to select a square
     */
    freezeBoard: function() {
      this.frozenBoard = true;
    },
    /*
     * Unfreeze the board
     * Allows selections to be made
     */
    unfreezeBoard: function() {
      this.frozenBoard = false;
    },
    /*
     * Show the hot squares for the time specified in the config
     * Hot squares are the random squares chosen by the game
     */
    showHotSquares: function() {
      var hotSquares = window.App.squares.where( { hot: true } );
      for ( var i = 0; i < hotSquares.length; i++ ) {
        hotSquares[i].addHighlight();
      }
    },
    /*
     * Generate a square_id based on the row and column
     * ids are in order 1-25
     */
    generateId: function(row,col) {
      return window.App.config.cols * (row - 1) + col;
    },
    /*
     * Return an array of random hot square ids
     * based on number of columns and rows and the selected ratio
     */
    randomizeHotList: function() {
      var arr = [];
      var total = Math.round( window.App.config.rows * window.App.config.cols * window.App.config.hotRatio );
      for( x = 1; x <= total; x++ ){
        var tmp = Math.floor( Math.random() * 25 ) + 1;
        while ( $.inArray( tmp, arr ) != -1 ) {
          tmp = Math.floor( Math.random() * 25 ) + 1;
        }
        arr.push( tmp );
      }
      return arr;
    },
    /*
     * Show controls based on configuration of game
     */
    controls: function( mes ) {
      switch( mes ) {
        case "startGame":
          $("#startGame").show();
          $("#resetGame").hide();
          break;
        case "gameStarted":
          $("#startGame").hide();
          $("#resetGame").show();
          break;
      }
    },
    /*
     * Adjust all square heights at once
     */ 
    squareHeight: function() {
      // Make sure we don't have extra bindings for this method
      $(window).off("resize");
      // Always keep the square heights equal to the square width
      this.$(".square").height(this.$(".square").width());
      // Especially when the window resizes
      $(window).on("resize",function(){
        this.$(".square").height(this.$(".square").width());
      });
    },
    /*
     * Show a success message
     */
    successMessage: function( message ) {
			this.clearMessages();
      $("#successMessage").show();
    },
    /* 
     * Show an error message
     */
    errorMessage: function( message ) {
			this.clearMessages();
      $("#errorMessage").show();
    },
    /*
     * Clear all messages
     */
    clearMessages: function()
    {
      $("#successMessage").hide();
			$("#errorMessage").hide();
    }
  });
});
