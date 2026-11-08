# frozen_string_literal: true

require 'test_helper'
require 'rubycritic/generators/html_report'

describe 'HTML report assets' do
  let(:assets_dir) { Pathname.new(RubyCritic::Generator::HtmlReport::ASSETS_DIR) }
  let(:templates_dir) { assets_dir.join('../templates') }
  let(:layout) { templates_dir.join('layouts/application.html.erb').read }
  let(:layout_scripts) { layout.scan(/<script src="<%= asset_path\("([^"]+)"\) %>">/).flatten }
  let(:layout_stylesheets) { layout.scan(/<link href="<%= asset_path\("([^"]+)"\) %>"/).flatten }

  # Asset paths that the templates pass to asset_path, e.g. "images/logo.png".
  let(:template_references) do
    Dir[templates_dir.join('**/*.erb')].flat_map do |template|
      File.read(template).scan(/asset_path\(\s*["']([^"']+)["']\s*\)/).flatten
    end
  end

  # Files that the referenced stylesheets load with url(...), e.g. fonts.
  let(:stylesheet_references) do
    template_references.select { |path| path.end_with?('.css') }.flat_map do |stylesheet|
      css = assets_dir.join(stylesheet)
      css.read.scan(/url\(\s*["']?([^"')]+)["']?\s*\)/).flatten
         .reject { |url| url.start_with?('data:') }
         .map { |url| (css.dirname + url.sub(/[?#].*\z/, '')).relative_path_from(assets_dir).to_s }
    end
  end

  let(:references) { (template_references + stylesheet_references).uniq }

  let(:files) do
    Dir[assets_dir.join('**/*')].select { |path| File.file?(path) }
                                .map { |path| Pathname.new(path).relative_path_from(assets_dir).to_s }
  end

  it 'has a file for every asset that the templates and stylesheets reference' do
    _(references.reject { |path| files.include?(path) }).must_be_empty
  end

  it 'loads Chart.js 4.6.1 for the overview charts' do
    _(layout_scripts).must_include 'vendor/javascripts/chart.umd.min.js'
    _(assets_dir.join('vendor/javascripts/chart.umd.min.js').read(200)).must_include 'Chart.js v4.6.1'
  end

  it 'ships no asset that nothing references' do
    _(files - references).must_be_empty
  end

  {
    'vendor/javascripts/bootstrap.min.js' => 'the report uses none of its plugins',
    'vendor/javascripts/jquery.scrollTo.min.js' => 'Element#scrollIntoView replaces it',
    'vendor/javascripts/jquery.timeago.js' => 'Intl.RelativeTimeFormat replaces it',
    'vendor/javascripts/jquery.filtertable.min.js' => 'a small filter in application.js replaces it',
    'vendor/javascripts/jquery.tablesorter.min.js' => 'a small sorter in application.js replaces it',
    'vendor/javascripts/prettify.js' => 'Rouge highlights the code when the report is generated',
    'vendor/javascripts/highcharts.src-4.0.1.js' => 'Chart.js (MIT) replaces it; Highcharts is commercial',
    'vendor/javascripts/jquery.min.js' => 'application.js uses the DOM API directly'
  }.each do |script, reason|
    it "does not load #{script}, because #{reason}" do
      _(layout_scripts).wont_include script
    end
  end

  {
    'vendor/stylesheets/prettify.custom_theme.css' => 'application.css styles the Rouge token classes'
  }.each do |stylesheet, reason|
    it "does not load #{stylesheet}, because #{reason}" do
      _(layout_stylesheets).wont_include stylesheet
    end
  end
end
